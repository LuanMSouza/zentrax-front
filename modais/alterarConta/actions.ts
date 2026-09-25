'use server'

import autenticar from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from 'bcrypt';

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

        if (Auth.role !== 'gestor') {
            return {
                success: false,
                error: "Apenas gestores podem alterar outros usuários."
            }
        }

        const alvo = await prisma.usuarios.findUnique({ where: { id: Number(dados.id) } })

        if (!alvo || Number(alvo.empresa_id) !== Number(Auth.empresa_id)) {
            return {
                success: false,
                error: "Usuário não encontrado."
            }
        }

        let DATA: UsuarioUpdate = { nome: dados.nome, usuario: dados.usuario, role: dados.role };

        if (dados.senha.trim()) {
            if (dados.senha.trim() !== dados.senhaConfirm.trim()) {
                return {
                    success: false,
                    error: 'As senhas não coincidem'
                };
            }

            if (dados.senha.trim().length < 6) {
                return {
                    success: false,
                    error: 'A senha precisa ter pelo menos 6 caracteres.'
                };
            }

            DATA.senha = await bcrypt.hash(dados.senha.trim(), 10);
        }

        const jaExiste = await prisma.usuarios.findFirst({
            where: {
                id: { not: Number(dados.id) },
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

        const { senha: _senha, reset_token: _resetToken, ...usuarioSeguro } = usuarioAlterado

        return {
            success: true,
            usuarioAlterado: usuarioSeguro
        }

    } catch (error: any) {
        console.error("Erro ao alterar usuario:", error)

        return {
            success: false,
            error: "Erro ao alterar o usuário."
        }

    }

}