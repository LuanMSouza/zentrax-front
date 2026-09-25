'use server'

import prisma from "@/lib/prisma"
import bcrypt from 'bcrypt'
import autenticar from "@/lib/auth"

type NovoUsuarioProps = {
    empresa_id: number,
    nome: string,
    usuario: string,
    email?: string,
    senha: string,
    senhaConfirm: string,
    role: string
}

export async function CriarUsuarioBack(dados: NovoUsuarioProps) {

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
            error: "Apenas gestores podem criar novos usuários."
        }
    }

    if (dados.senha !== dados.senhaConfirm) {
        return {
            success: false,
            error: 'As senhas não se coincidem!!'
        }
    }

    if (dados.senha.trim().length < 6) {
        return {
            success: false,
            error: 'A senha precisa ter pelo menos 6 caracteres.'
        }
    }

    const email = dados.email?.trim().toLowerCase() || null

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
            success: false,
            error: 'Informe um e-mail válido.'
        }
    }

    const jaExiste = await prisma.usuarios.findFirst({
        where: {
            OR: [
                { usuario: { equals: dados.usuario, mode: 'insensitive' } },
                ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
            ]
        }
    })

    if (jaExiste) {
        return {
            success: false,
            error: 'Esse nome de usuario ou e-mail já está sendo utilizado, por favor, escolha outro!!'
        }
    }

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    try {

        const novoUsuario = await prisma.usuarios.create({
            data: {
                empresa_id: Number(Auth.empresa_id),
                nome: dados.nome,
                usuario: dados.usuario,
                email,
                senha: senhaHash,
                role: dados.role
            }
        })

        const { senha: _senha, reset_token: _resetToken, ...usuarioSeguro } = novoUsuario

        return {
            success: true,
            novoUsuario: usuarioSeguro
        }

    } catch (error) {
        console.error("Erro ao criar usuario:", error)

        return {
            success: false,
            error: "Erro ao criar o usuário."
        }

    }

}