'use server'
import autenticar from "@/lib/auth";
import prisma from "@/lib/prisma"
import bcrypt from 'bcrypt';
import { boolean, success } from "zod";

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
    avisar: boolean
}

export async function PegarPreferenciasBack() {
    const Auth = await autenticar()

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    const preferencias: Preferencias | null = await prisma.empresa_settings.findFirst({
        where: {
            empresa_id: Number(Auth.empresa_id)
        },
        select: {
            empresa_id: true,
            cobranca_text: true,
            avisar: true
        }
    })

    if (preferencias) {
        return {
            success: true,
            data: preferencias
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

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    try {
        await prisma.empresa_settings.update({
            where: {
                empresa_id: Number(Auth.empresa_id)
            },
            data: {
                avisar: Boolean(preferencias.avisar),
                cobranca_text: Number(preferencias.cobranca_text)
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