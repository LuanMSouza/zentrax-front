'use server'
import autenticar from "@/lib/auth";
import prisma from "@/lib/prisma"
import bcrypt from 'bcrypt';

export async function ConfirmarSenha({ id, senha }: { id: number, senha: string }) {
    try {
        const dadosUser = await prisma.usuarios.findUnique({
            where: { id: Number(id) }
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
    const { id, nome, usuario, senha } = form


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
            dataUpdate.senha = String(senha)
        }

        const update = await prisma.usuarios.update({
            where: { id: Number(id) },
            data: dataUpdate
        })

        return {
            success: true,
            usuarioNovo: [update]
        }

    } catch (error) {
        console.error("Erro ao alterar perfil:", error)
        return {
            success: false,
            error: "Erro ao atualizar os dados no banco."
        }
    }
}

export async function PegarUsuariosDaConta({ id }: { id: number }) {

    const Auth = await autenticar()

    if (!Auth) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    const usuarios = await prisma.usuarios.findMany({
        where: {
            empresa_id: Number(id)
        }
    })

    console.log(id);


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

    try {
        await prisma.usuarios.delete({
            where: { id: Number(id) }
        })

        return {
            success: true
        }

    } catch (error: any) {

        return {
            success: false,
            error
        }

    }

}