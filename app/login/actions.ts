'use server'

import prisma from "@/lib/prisma"; // Use aquele Singleton que criamos
import bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken'; // Substitui o fastify.jwt
import { cookies } from 'next/headers'

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

export async function enviarLogin(formData: FormData) {
    const email = formData.get('email') as string;
    const senha = formData.get('password') as string;

    try {
        const usuario = await prisma.usuarios.findFirst({
            where: {
                usuario: {
                    equals: email.toLowerCase().trim(),
                    mode: 'insensitive'
                }
            },
            include: {
                empresa: {
                    include: { empresa_settings: true }
                }
            }
        });

        if (!usuario || !usuario.empresa) {
            return { success: false, error: "Usuário sem empresa vinculada." };
        }

        if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
            return { success: false, error: `Muitas tentativas incorretas. Tente novamente em alguns minutos.` };
        }

        let senhaValida = false;
        const hashRegex = /^\$2[aby]\$.{56}$/;

        if (hashRegex.test(usuario.senha)) {
            senhaValida = await bcrypt.compare(senha, usuario.senha);
        } else {
            senhaValida = senha === usuario.senha;

            if (senhaValida) {
                const novoHash = await bcrypt.hash(senha, 10);
                await prisma.usuarios.update({
                    where: { id: usuario.id },
                    data: { senha: novoHash }
                });
            }
        }

        if (!senhaValida) {
            const tentativas = (usuario.tentativas_login ?? 0) + 1;
            const atingiuLimite = tentativas >= MAX_TENTATIVAS;

            await prisma.usuarios.update({
                where: { id: usuario.id },
                data: {
                    tentativas_login: atingiuLimite ? 0 : tentativas,
                    bloqueado_ate: atingiuLimite
                        ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000)
                        : null
                }
            });

            if (atingiuLimite) {
                return { success: false, error: `Muitas tentativas incorretas. Conta bloqueada por ${BLOQUEIO_MINUTOS} minutos.` };
            }

            return { success: false, error: 'Usuário ou senha inválidos' };
        }

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

        if (usuario.tentativas_login || usuario.bloqueado_ate) {
            await prisma.usuarios.update({
                where: { id: usuario.id },
                data: { tentativas_login: 0, bloqueado_ate: null }
            });
        }

        const token = sign({
            usuario_id: usuario.id,
            empresa_id: usuario.empresa_id,
            role: usuario.role
        }, process.env.JWT_SECRET!, { expiresIn: '1d' });

        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24
        });

        return {
            success: true,
            data: {
                token,
                empresa: {
                    id: usuario?.empresa.id,
                    nome: usuario?.empresa.nome,
                    segmento: usuario?.empresa.segmento,
                    expiracao: usuario?.empresa.data_expiracao
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