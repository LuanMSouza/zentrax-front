'use server'

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'

export async function redefinirSenha(formData: FormData) {
    const token = String(formData.get('token') ?? '')
    const novaSenha = String(formData.get('novaSenha') ?? '')
    const confirmarSenha = String(formData.get('confirmarSenha') ?? '')

    if (!token) {
        return { success: false, error: 'Link inválido.' }
    }

    if (novaSenha.length < 6) {
        return { success: false, error: 'A senha precisa ter pelo menos 6 caracteres.' }
    }

    if (novaSenha !== confirmarSenha) {
        return { success: false, error: 'As senhas não coincidem.' }
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { reset_token_hash: tokenHash },
        })

        if (!usuario || !usuario.reset_token_expira || usuario.reset_token_expira < new Date()) {
            return { success: false, error: 'Esse link expirou ou já foi usado. Solicite um novo.' }
        }

        const senhaHash = await bcrypt.hash(novaSenha, 10)

        await prisma.usuarios.update({
            where: { id: usuario.id },
            data: {
                senha: senhaHash,
                reset_token_hash: null,
                reset_token_expira: null,
                tentativas_login: 0,
                bloqueado_ate: null,
            },
        })

        return { success: true }
    } catch (error) {
        console.error('Erro ao redefinir senha:', error)
        return { success: false, error: 'Erro interno no servidor' }
    }
}
