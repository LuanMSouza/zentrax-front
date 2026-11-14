'use server'

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'
import { erroDaSenhaNova } from '@/lib/senha'
import { encerrarSessoes } from '@/lib/sessao'

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

type RedefinirResult =
    | { success: true }
    | { success: false; error: string }

export async function redefinirSenha(token: string, novaSenha: string): Promise<RedefinirResult> {
    if (typeof token !== 'string' || !token || typeof novaSenha !== 'string') {
        return { success: false, error: 'Link inválido.' }
    }

    const erroSenha = erroDaSenhaNova(novaSenha)
    if (erroSenha) {
        return { success: false, error: erroSenha }
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
    // quem estava logado com a senha velha (inclusive quem roubou a sessão) sai na hora
    await encerrarSessoes(usuario.id)

    return { success: true }
}
