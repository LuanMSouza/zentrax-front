'use server'

import autenticar from "@/lib/auth";
import prisma from "@/lib/prisma";

type AlterarUsuarioProps = {
    id: number,
    nome: string,
    usuario: string,
    senha: string,
    senhaConfirm: string,
    role: string
}

type UsuarioUpdate = {
    nome: string;
    usuario: string;
    role: string;
    senha?: string; // O '?' indica que é opcional
};

export async function AlterarUsuarioBack(dados: AlterarUsuarioProps) {

    try {

        const Auth = await autenticar()

        if (!Auth) {
            return {
                success: false,
                error: "Sessão expirada ou inválida"
            }
        }


        let DATA: UsuarioUpdate = { nome: dados.nome, usuario: dados.usuario, role: dados.role };

        if (dados.senha.trim()) {
            if (dados.senha.trim() === dados.senhaConfirm.trim()) {
                DATA.senha = dados.senha;
            } else {
                return {
                    success: false,
                    error: 'As senhas não coincidem'
                };
            }
        }

        const jaExiste = await prisma.usuarios.findFirst({
            where: {
                usuario: {
                    equals: dados.usuario,
                    mode: 'insensitive',
                }
            }
        })

        if (jaExiste) {
            return {
                success: false,
                error: 'Esse nome de usuario já está sendo utilizado, por favor, escolha outro!!'
            }
        }

        const usuarioAlterado = await prisma.usuarios.update({
            where: {
                id: Number(dados.id)
            },
            data: DATA
        })

        return {
            success: true,
            usuarioAlterado
        }

    } catch (error: any) {

        return {
            success: false,
            error
        }

    }

}