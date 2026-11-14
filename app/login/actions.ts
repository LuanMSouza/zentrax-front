'use server'

import prisma from "@/lib/prisma"; // Use aquele Singleton que criamos
import bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken'; // Substitui o fastify.jwt
import { headers } from 'next/headers'
import { abrirSessao } from '@/lib/sessao'
import { ehHashBcrypt } from '@/lib/senha'
import { estourou, anotarFalha, ipDosHeaders } from '@/lib/rateLimit'

// hash de mentira só pra gastar o mesmo tempo quando o login não existe
const HASH_FALSO = '$2b$10$1.YQOza0n.8QH.1cvduEAOCIlU3GIULSbPuBZYpTUrvlIvmT9e.mC'

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;
const JANELA_MS = BLOQUEIO_MINUTOS * 60 * 1000;
// por IP (só quando o nginx manda o X-Real-IP): várias contas diferentes testadas da mesma máquina
const MAX_ERROS_POR_IP = 20;

// Mesma frase pra conta bloqueada, IP bloqueado e login inexistente depois de 5 erros: ninguém descobre pelo
// texto se um login existe.
const MUITAS_TENTATIVAS = { success: false as const, error: 'Muitas tentativas incorretas. Tente novamente em alguns minutos.' };
const INVALIDO = { success: false as const, error: 'Usuário ou senha inválidos' };

export async function enviarLogin(formData: FormData) {
    const email = String(formData.get('email') ?? '');
    const senha = String(formData.get('password') ?? '');
    const login = email.toLowerCase().trim().slice(0, 100);

    try {
        const ip = ipDosHeaders(await headers());
        const chaveIp = ip !== 'desconhecido' ? `login:ip:${ip}` : null;
        if (chaveIp && estourou(chaveIp, MAX_ERROS_POR_IP, JANELA_MS)) return MUITAS_TENTATIVAS;

        const usuario = await prisma.usuarios.findFirst({
            where: {
                usuario: {
                    equals: login,
                    mode: 'insensitive'
                }
            },
            // com o índice único em lower(usuario) só existe 1; o orderBy deixa a escolha previsível mesmo antes dele
            orderBy: { id: 'asc' },
            include: {
                empresa: {
                    // a logo do comprovante (até ~200KB) não vai junto: o login guarda as settings no localStorage
                    include: { empresa_settings: { omit: { logo_comprovante: true } } }
                }
            }
        });

        if (!usuario || !usuario.empresa) {
            // Mesma mensagem e mesmo tempo de "senha errada": antes, login inexistente respondia "Usuário sem empresa
            // vinculada" e senha errada respondia "Usuário ou senha inválidos", o que revelava quais logins existem.
            // E depois de 5 erros também diz "Muitas tentativas", igual a uma conta de verdade bloqueada.
            await bcrypt.compare(senha, HASH_FALSO);
            const chaveFantasma = `login:inexistente:${login}`;
            anotarFalha(chaveFantasma);
            if (chaveIp) anotarFalha(chaveIp);
            return estourou(chaveFantasma, MAX_TENTATIVAS, JANELA_MS) ? MUITAS_TENTATIVAS : INVALIDO;
        }

        // Reserva a tentativa ANTES de conferir a senha, num UPDATE só (atômico). Antes o código lia o contador, somava
        // em JS e gravava: 30 tentativas ao mesmo tempo liam todas "0" e a conta nunca bloqueava. Agora cada tentativa
        // ganha um número único; da 6ª em diante (ou com a conta bloqueada) nem chega no bcrypt.
        // bloqueado_ate é "timestamp" sem fuso e o Prisma grava em UTC, por isso o now() AT TIME ZONE 'UTC'.
        const reserva = await prisma.$queryRaw<{ tentativas_login: number }[]>`
            UPDATE usuarios SET tentativas_login = COALESCE(tentativas_login, 0) + 1
            WHERE id = ${usuario.id} AND (bloqueado_ate IS NULL OR bloqueado_ate <= (now() AT TIME ZONE 'UTC'))
            RETURNING tentativas_login`;
        if (reserva.length === 0) return MUITAS_TENTATIVAS;

        const bloquear = () => prisma.$executeRaw`
            UPDATE usuarios SET tentativas_login = 0,
                   bloqueado_ate = (now() AT TIME ZONE 'UTC') + make_interval(mins => ${BLOQUEIO_MINUTOS})
            WHERE id = ${usuario.id}`;

        if (reserva[0].tentativas_login > MAX_TENTATIVAS) {
            await bloquear();
            return MUITAS_TENTATIVAS;
        }

        // só aceita hash bcrypt (não existe mais senha em texto puro no banco; esse caminho antigo só ampliava o risco)
        const senhaValida = ehHashBcrypt(usuario.senha) && await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            if (chaveIp) anotarFalha(chaveIp);
            if (reserva[0].tentativas_login >= MAX_TENTATIVAS) {
                await bloquear();
                return MUITAS_TENTATIVAS;
            }
            return INVALIDO;
        }

        // senha certa: zera o contador (inclusive pra loja vencida, que só recebe o billingToken)
        await prisma.usuarios.update({
            where: { id: usuario.id },
            data: { tentativas_login: 0, bloqueado_ate: null }
        });

        const expirou = usuario.empresa.data_expiracao && new Date(usuario.empresa.data_expiracao) < new Date();

        if (usuario.empresa.status !== 'ativo' || expirou) {
            // Só quem já provou a senha chega aqui - emite um token de escopo
            // restrito (só serve pra iniciar um checkout do Stripe pra essa
            // empresa) pra permitir assinar/renovar mesmo sem sessão completa.
            const billingToken = sign(
                { empresa_id: usuario.empresa_id, purpose: 'billing' },
                process.env.JWT_SECRET!,
                { expiresIn: '30m' }
            );

            return {
                success: false,
                error: expirou
                    ? 'Seu período de teste/assinatura expirou.'
                    : 'Sua assinatura está inativa.',
                podeAssinar: true,
                billingToken,
            };
        }

        await abrirSessao({ id: usuario.id, empresa_id: usuario.empresa_id, role: usuario.role });

        return {
            success: true,
            // o token NÃO vai no corpo: ele fica só no cookie HttpOnly (o JavaScript da página não precisa dele)
            data: {
                empresa: {
                    id: usuario?.empresa.id,
                    nome: usuario?.empresa.nome,
                    segmento: usuario?.empresa.segmento,
                    expiracao: usuario?.empresa.data_expiracao,
                    assinante: !!usuario?.empresa.stripe_subscription_id
                },
                usuario: {
                    id: usuario?.id,
                    nome: usuario?.nome,
                    usuario: usuario?.usuario,
                    role: usuario?.role,
                },
                settings: usuario?.empresa.empresa_settings
            }
        };

    } catch (error) {
        console.error("Erro no login:", error);
        return { success: false, error: 'Erro interno no servidor' };
    }
}