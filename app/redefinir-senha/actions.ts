'use server'

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

type RedefinirResult =
    | { success: true }
    | { success: false; error: string }

export async function redefinirSenha(token: string, novaSenha: string): Promise<RedefinirResult> {
    if (!token) {
        return { success: false, error: 'Link inválido.' }
    }

    if (novaSenha.length < 6) {
        return { success: false, error: 'A senha precisa ter pelo menos 6 caracteres.' }
    }

    const usuario = await prisma.usuarios.findFirst({
        where: { reset_token: hashToken(token) }
    })

    if (!usuario || !usuario.reset_token_expira || usuario.reset_token_expira < new Date()) {
        return { success: false, error: 'Link inválido ou expirado. Solicite a recuperação de novo.' }
    }

    const novoHash = await bcrypt.hash(novaSenha, 10)

    await prisma.usuarios.update({
        where: { id: usuario.id },
        data: {
            senha: novoHash,
            reset_token: null,
            reset_token_expira: null,
            tentativas_login: 0,
            bloqueado_ate: null
        }
    })

    return { success: true }
}
