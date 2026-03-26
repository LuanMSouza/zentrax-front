'use server'

import prisma from "@/lib/prisma"
import bcrypt from 'bcrypt'

type NovoUsuarioProps = {
    empresa_id: number,
    nome: string,
    usuario: string,
    senha: string,
    senhaConfirm: string,
    role: string
}

export async function CriarUsuarioBack(dados: NovoUsuarioProps) {

    if (dados.senha !== dados.senhaConfirm) {
        return {
            success: false,
            error: 'As senhas não se coincidem!!'
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

    const senhaHash = await bcrypt.hash(dados.senha, 10);
    try {

        const novoUsuario = await prisma.usuarios.create({
            data: {
                empresa_id: Number(dados.empresa_id),
                nome: dados.nome,
                usuario: dados.usuario,
                senha: senhaHash,
                role: dados.role
            }
        })

        return {
            success: true,
            novoUsuario
        }

    } catch (error) {

        return {
            success: false,
            error
        }

    }

}