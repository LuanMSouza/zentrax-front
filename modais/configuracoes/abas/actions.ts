'use server'
import autenticar from "@/lib/auth";
import prisma from "@/lib/prisma"
import bcrypt from 'bcrypt';
import { Prisma } from "@prisma/client";
import { conferirSenhaDoUsuario, erroDaSenhaNova, MENSAGEM_SENHA } from "@/lib/senha";
import { abrirSessao, encerrarSessoes, esquecerSessao } from "@/lib/sessao";
import { ehEmpresaDemo, BLOQUEADO_NA_DEMO } from "@/lib/demo";
import { MAX_JUROS_MES, MAX_MULTA, MAX_CARENCIA } from "@/lib/juros";
import { chavePixValida, normalizarChavePix } from "@/lib/pix";
import { lerPermissoes, LISTA_PERMISSOES, PERMISSOES } from "@/lib/permissoes";
import RegistrarAcao from "@/lib/logger";

// Confere a senha de quem está logado (telas de usuários pedem antes de abrir). Só bcrypt e com limite de erros
// (lib/senha.ts): antes aceitava a senha igual ao texto guardado e não tinha limite.
export async function ConfirmarSenha({ senha }: { id?: number, senha: string }) {
    const Auth = await autenticar()

    try {
        const r = await conferirSenhaDoUsuario(Number(Auth.usuario_id), senha)
        if (r !== 'ok') return { success: false, error: MENSAGEM_SENHA[r] }
        return { success: true };
    } catch (error) {
        console.error("Erro na verificação de senha:", error);
        return { success: false, error: 'Erro interno no servidor' };
    }
}

type AlterarPerfilProps = {
    id?: number,
    nome: string,
    usuario: string,
    senha: string | null,
    confirmarSenha: string | null,
    senhaAtual?: string | null,
}

// Perfil do próprio usuário. Trocar a SENHA ou o LOGIN pede a senha atual, conferida aqui no servidor (antes só a
// tela conferia: quem pegasse um computador logado, ou o token, trocava a senha e tomava a conta).
export async function Alterarperfil(form: AlterarPerfilProps) {
    const Auth = await autenticar()
    if (await ehEmpresaDemo(Auth?.empresa_id)) return BLOQUEADO_NA_DEMO

    const usuarioId = Number(Auth.usuario_id)
    const nome = String(form.nome ?? '').trim()
    const login = String(form.usuario ?? '').trim()
    const senha = String(form.senha ?? '').trim()

    if (!nome || !login) return { success: false, error: "Nome e usuário são obrigatórios." }
    if (nome.length > 120 || login.length > 50) return { success: false, error: "Nome ou usuário grande demais." }

    try {
        const atual = await prisma.usuarios.findUnique({ where: { id: usuarioId }, select: { usuario: true } })
        if (!atual) return { success: false, error: "Usuário não encontrado." }

        const mudaLogin = login !== atual.usuario
        const mudaSenha = senha !== ''

        if (mudaSenha) {
            const erro = erroDaSenhaNova(senha)
            if (erro) return { success: false, error: erro }
            if (form.confirmarSenha != null && String(form.confirmarSenha).trim() !== senha) {
                return { success: false, error: "As senhas não coincidem." }
            }
        }

        if (mudaSenha || mudaLogin) {
            const r = await conferirSenhaDoUsuario(usuarioId, form.senhaAtual)
            if (r !== 'ok') return { success: false, error: r === 'errada' ? 'Sua senha atual não confere.' : MENSAGEM_SENHA[r] }
        }

        // login é único sem olhar maiúscula: "GESTOR.A" não pode existir se já existe "gestor.a" (o login de outra
        // pessoa parava de funcionar). O índice único em lower(usuario) segura o caso de dois salvando ao mesmo tempo.
        if (mudaLogin) {
            const jaExiste = await prisma.usuarios.findFirst({
                where: { id: { not: usuarioId }, usuario: { equals: login, mode: 'insensitive' } },
                select: { id: true }
            })
            if (jaExiste) return { success: false, error: "Esse nome de usuário já está em uso. Escolha outro." }
        }

        const update = await prisma.usuarios.update({
            where: { id: usuarioId },
            data: {
                nome,
                usuario: login,
                ...(mudaSenha ? { senha: await bcrypt.hash(senha, 10) } : {})
            }
        })

        // senha nova derruba as outras sessões abertas (outro aparelho, token roubado) e mantém esta logada
        if (mudaSenha) {
            await encerrarSessoes(usuarioId)
            await abrirSessao({ id: usuarioId, empresa_id: update.empresa_id, role: update.role })
        }

        const { senha: _senha, reset_token: _resetToken, ...usuarioSeguro } = update

        return {
            success: true,
            usuarioNovo: [usuarioSeguro]
        }

    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return { success: false, error: "Esse nome de usuário já está em uso. Escolha outro." }
        }
        console.error("Erro ao alterar perfil:", error)
        return {
            success: false,
            error: "Erro ao atualizar os dados no banco."
        }
    }
}

export async function PegarUsuariosDaConta({ id }: { id?: number }) {

    const Auth = await autenticar()

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    const usuarios = await prisma.usuarios.findMany({
        where: {
            empresa_id: Number(Auth.empresa_id)
        },
        select: {
            id: true,
            nome: true,
            usuario: true,
            role: true,
            tipo: true,
            empresa_id: true,
            criacao: true
        }
    })

    return {
        success: true,
        usuarios
    }

}

// excluit Conta

export async function ApagarContaBack(id: number) {

    const Auth = await autenticar()
    if (await ehEmpresaDemo(Auth?.empresa_id)) return BLOQUEADO_NA_DEMO

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    if (Auth.role !== 'gestor') {
        return {
            success: false,
            error: "Apenas gestores podem remover usuários."
        }
    }

    if (Number(id) === Number(Auth.usuario_id)) {
        return {
            success: false,
            error: "Você não pode remover a própria conta por aqui."
        }
    }

    try {
        const alvo = await prisma.usuarios.findUnique({ where: { id: Number(id) } })

        if (!alvo || Number(alvo.empresa_id) !== Number(Auth.empresa_id)) {
            return {
                success: false,
                error: "Usuário não encontrado."
            }
        }

        await prisma.usuarios.delete({
            where: { id: Number(id) }
        })
        // sem isso o cache de 30 s do autenticar() deixava o removido usar o sistema mais um pouco
        esquecerSessao(Number(id))

        return {
            success: true
        }

    } catch (error: any) {
        console.error("Erro ao apagar conta:", error)

        return {
            success: false,
            error: "Erro ao remover o usuário."
        }

    }

}

// pegar preferencias

type Preferencias = {
    empresa_id: number,
    usar_papel_grande?: boolean,
    cobranca_text?: number | null
    avisar: boolean,
    avisar_vencimentos?: boolean,
    telefone?: string | null,
    endereco?: string | null,
    rodape_comprovante?: string | null,
    juros_ativo?: boolean,
    juros_mes?: number | string,
    multa_atraso?: number | string,
    juros_carencia?: number | string,
    logo_comprovante?: string | null, // undefined = não mexe; null = tira a logo
    resumo_mensal?: boolean,
    pix_chave?: string | null,
    pix_nome?: string | null,
    pix_cidade?: string | null,
    qr_extrato?: boolean
}

// Logo do comprovante: só PNG em data URL (o navegador já reduziu e converteu) e com teto de tamanho (o banco tem o
// mesmo CHECK). Qualquer outra coisa é recusada em vez de gravada.
const LOGO_MAX = 200_000
function logoValida(valor: unknown): valor is string {
    if (typeof valor !== 'string' || valor.length > LOGO_MAX || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(valor)) return false
    // e tem que ser PNG de verdade: os 8 primeiros bytes de todo PNG são sempre esses
    const inicio = Buffer.from(valor.slice('data:image/png;base64,'.length, 'data:image/png;base64,'.length + 12), 'base64')
    return inicio.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
}

// número de um campo de % ou dias: aceita "1,5", corta nos limites (os mesmos do CHECK no banco)
function numeroEntre(valor: unknown, max: number) {
    const n = Number(String(valor ?? '').replace(',', '.'))
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
}

// texto livre vindo do formulário: apara, corta no tamanho da coluna e grava vazio como null
function textoOuNull(valor: unknown, max: number) {
    const texto = String(valor ?? '').trim().slice(0, max);
    return texto || null;
}

export async function PegarPreferenciasBack() {
    const Auth = await autenticar()

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    const preferencias = await prisma.empresa_settings.findFirst({
        where: {
            empresa_id: Number(Auth.empresa_id)
        },
        select: {
            empresa_id: true,
            cobranca_text: true,
            avisar: true,
            avisar_vencimentos: true,
            telefone: true,
            endereco: true,
            rodape_comprovante: true,
            juros_ativo: true,
            juros_mes: true,
            multa_atraso: true,
            juros_carencia: true,
            logo_comprovante: true,
            resumo_mensal: true,
            pix_chave: true,
            pix_nome: true,
            pix_cidade: true,
            emails_respondido_em: true,
            qr_extrato: true
        }
    })

    if (preferencias) {
        return {
            success: true,
            // Decimal do Prisma não atravessa pro navegador: vira número
            data: {
                ...preferencias,
                // enquanto a loja não respondeu se quer e-mails, nenhum sai: a tela mostra desligado, que é o que vale
                avisar_vencimentos: preferencias.emails_respondido_em ? preferencias.avisar_vencimentos : false,
                resumo_mensal: preferencias.emails_respondido_em ? preferencias.resumo_mensal : false,
                emails_respondido_em: undefined,
                juros_mes: Number(preferencias.juros_mes ?? 0),
                multa_atraso: Number(preferencias.multa_atraso ?? 0),
            }
        }
    }

    else {
        return {
            success: false,
            error: `erro ao buscar dados!!`
        }
    }


}

// enviar preferencias
export async function AtualizarPreferencias(preferencias: Preferencias) {

    const Auth = await autenticar()
    if (await ehEmpresaDemo(Auth?.empresa_id)) return BLOQUEADO_NA_DEMO

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    const chavePix = String(preferencias.pix_chave ?? '').trim()
    if (chavePix && !chavePixValida(chavePix)) {
        return { success: false, error: "A chave Pix não parece válida. Confira e tente de novo." }
    }

    if (preferencias.logo_comprovante && !logoValida(preferencias.logo_comprovante)) {
        return { success: false, error: "Essa imagem não deu pra usar. Tente um PNG ou JPG menor." }
    }

    // mexer nos avisos por e-mail aqui também vale como resposta ao "quer receber?" (mesma regra do que a tela mostra)
    const atual = await prisma.empresa_settings.findFirst({
        where: { empresa_id: Number(Auth.empresa_id) },
        select: { avisar_vencimentos: true, resumo_mensal: true, emails_respondido_em: true }
    })
    const respondido = !!atual?.emails_respondido_em
    const vencimentosAgora = preferencias.avisar_vencimentos !== false
    const resumoAgora = preferencias.resumo_mensal !== false
    const mexeuNosEmails = respondido
        ? true
        : vencimentosAgora !== false || resumoAgora !== false

    try {
        await prisma.empresa_settings.update({
            where: {
                empresa_id: Number(Auth.empresa_id)
            },
            data: {
                avisar: Boolean(preferencias.avisar),
                ...(mexeuNosEmails ? {
                    avisar_vencimentos: vencimentosAgora,
                    resumo_mensal: resumoAgora,
                    ...(respondido ? {} : { emails_respondido_em: new Date() }),
                } : {}),
                cobranca_text: Number(preferencias.cobranca_text),
                telefone: textoOuNull(preferencias.telefone, 20),
                endereco: textoOuNull(preferencias.endereco, 120),
                rodape_comprovante: textoOuNull(preferencias.rodape_comprovante, 80),
                ...(typeof preferencias.qr_extrato === 'boolean' ? { qr_extrato: preferencias.qr_extrato } : {}),
                ...(preferencias.logo_comprovante !== undefined ? { logo_comprovante: preferencias.logo_comprovante || null } : {}),
                // chave Pix decide pra onde vai o dinheiro: só gestor muda
                ...(Auth.role === 'gestor' && preferencias.pix_chave !== undefined ? {
                    pix_chave: chavePix ? normalizarChavePix(chavePix) : null,
                    pix_nome: textoOuNull(preferencias.pix_nome, 25),
                    pix_cidade: textoOuNull(preferencias.pix_cidade, 15),
                } : {}),
                // juros muda o valor que aparece pro cliente: só gestor mexe (os outros campos seguem abertos)
                ...(Auth.role === 'gestor' && preferencias.juros_ativo !== undefined ? {
                    juros_ativo: Boolean(preferencias.juros_ativo),
                    juros_mes: numeroEntre(preferencias.juros_mes, MAX_JUROS_MES),
                    multa_atraso: numeroEntre(preferencias.multa_atraso, MAX_MULTA),
                    juros_carencia: Math.round(numeroEntre(preferencias.juros_carencia, MAX_CARENCIA)),
                } : {})
            }
        })

        return {
            success: true,
        }

    } catch (error: any) {
        console.error("Erro ao atualizar preferencias:", error)

        return {
            success: false,
            error: "Erro ao atualizar as preferências."
        }
    }
}
// Permissões dos atendentes (Configurações > Conta). Só gestor lê e muda.
export async function permissoesAtendenteBack() {
    const Auth = await autenticar()
    if (!Auth || Auth.role !== 'gestor') return null
    const s = await prisma.empresa_settings.findFirst({ where: { empresa_id: Number(Auth.empresa_id) }, select: { permissoes_atendente: true } })
    return lerPermissoes(s?.permissoes_atendente)
}

export async function salvarPermissoesAtendenteBack(permissoes: Record<string, unknown>) {
    const Auth = await autenticar()
    if (await ehEmpresaDemo(Auth?.empresa_id)) return BLOQUEADO_NA_DEMO
    if (!Auth || Auth.role !== 'gestor') return { success: false, error: "Só gestor muda as permissões." }

    // lerPermissoes descarta chave desconhecida e qualquer valor que não seja true
    const limpas = lerPermissoes(permissoes)
    await prisma.empresa_settings.update({ where: { empresa_id: Number(Auth.empresa_id) }, data: { permissoes_atendente: limpas } })

    const ligadas = LISTA_PERMISSOES.filter(p => limpas[p]).map(p => PERMISSOES[p].rotulo.toLowerCase())
    await RegistrarAcao({
        tabela: 'Usuarios',
        operacao: ligadas.length ? `Liberou pros atendentes: ${ligadas.join(', ')}` : 'Tirou todas as permissões extras dos atendentes',
        empresa_id: Number(Auth.empresa_id),
        usuario_id: Number(Auth.usuario_id)
    })
    return { success: true }
}
