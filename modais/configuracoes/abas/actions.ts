'use server'
import autenticar from "@/lib/auth";
import prisma from "@/lib/prisma"
import bcrypt from 'bcrypt';
import { boolean, success } from "zod";
import { ehEmpresaDemo, BLOQUEADO_NA_DEMO } from "@/lib/demo";
import { MAX_JUROS_MES, MAX_MULTA, MAX_CARENCIA } from "@/lib/juros";
import { chavePixValida, normalizarChavePix } from "@/lib/pix";

export async function ConfirmarSenha({ senha }: { id?: number, senha: string }) {
    try {
        const Auth = await autenticar()

        if (!Auth) {
            return { success: false, error: 'Sessão expirada ou inválida' };
        }

        const dadosUser = await prisma.usuarios.findUnique({
            where: { id: Number(Auth.usuario_id) }
        });

        if (!dadosUser || !dadosUser.senha) {
            return { success: false, error: 'Usuário não encontrado' };
        }

        const senhaFornecida = String(senha).trim();
        const senhaNoBanco = String(dadosUser.senha).trim();

        let senhaValida = false;

        try {
            senhaValida = await bcrypt.compare(senhaFornecida, senhaNoBanco);
        } catch (e) {
            senhaValida = false;
        }

        if (!senhaValida) {
            senhaValida = senhaFornecida === senhaNoBanco;
        }

        if (!senhaValida) {
            return { success: false, error: 'Senha incorreta' };
        }

        return { success: true };

    } catch (error) {
        console.error("Erro na verificação de senha:", error);
        return { success: false, error: 'Erro interno no servidor' };
    }
}

type AlterarPerfilProps = {
    id: Number,
    nome: string,
    usuario: string,
    senha: string | null,
    confirmarSenha: string | null,
}

export async function Alterarperfil(form: AlterarPerfilProps) {
    const { nome, usuario, senha } = form


    const Auth = await autenticar()
    if (await ehEmpresaDemo(Auth?.empresa_id)) return BLOQUEADO_NA_DEMO

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    try {
        let dataUpdate: any = {
            nome: String(nome),
            usuario: String(usuario)
        }

        if (senha && senha.trim() !== "") {
            if (senha.trim().length < 6) {
                return {
                    success: false,
                    error: "A senha precisa ter pelo menos 6 caracteres."
                }
            }

            dataUpdate.senha = await bcrypt.hash(senha.trim(), 10)
        }

        const update = await prisma.usuarios.update({
            where: { id: Number(Auth.usuario_id) },
            data: dataUpdate
        })

        const { senha: _senha, reset_token: _resetToken, ...usuarioSeguro } = update

        return {
            success: true,
            usuarioNovo: [usuarioSeguro]
        }

    } catch (error) {
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
    pix_cidade?: string | null
}

// Logo do comprovante: só PNG em data URL (o navegador já reduziu e converteu) e com teto de tamanho (o banco tem o
// mesmo CHECK). Qualquer outra coisa é recusada em vez de gravada.
const LOGO_MAX = 200_000
function logoValida(valor: unknown): valor is string {
    return typeof valor === 'string' && valor.length <= LOGO_MAX && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(valor)
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
            pix_cidade: true
        }
    })

    if (preferencias) {
        return {
            success: true,
            // Decimal do Prisma não atravessa pro navegador: vira número
            data: {
                ...preferencias,
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

    try {
        await prisma.empresa_settings.update({
            where: {
                empresa_id: Number(Auth.empresa_id)
            },
            data: {
                avisar: Boolean(preferencias.avisar),
                avisar_vencimentos: preferencias.avisar_vencimentos !== false,
                cobranca_text: Number(preferencias.cobranca_text),
                telefone: textoOuNull(preferencias.telefone, 20),
                endereco: textoOuNull(preferencias.endereco, 120),
                rodape_comprovante: textoOuNull(preferencias.rodape_comprovante, 80),
                ...(preferencias.logo_comprovante !== undefined ? { logo_comprovante: preferencias.logo_comprovante || null } : {}),
                resumo_mensal: preferencias.resumo_mensal !== false,
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