'use server'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { enviarEmailRecuperacaoSenha } from '@/lib/email'

const APP_URL = process.env.APP_URL ?? 'https://app.zentrax.dvls.com.br'
const VALIDADE_TOKEN_MS = 60 * 60 * 1000 // 1h
const COOLDOWN_REENVIO_MS = 2 * 60 * 1000 // evita spam de clique

function hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

// Resposta sempre genérica (mesmo se o e-mail não existir) pra não vazar
// quais e-mails estão cadastrados.
const RESPOSTA_GENERICA = {
    success: true,
    message: 'Se esse e-mail estiver cadastrado, enviamos um link de recuperação.'
}

export async function solicitarRecuperacaoSenha(email: string) {
    const usuario = await prisma.usuarios.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } }
    })

    if (!usuario || !usuario.email) {
        return RESPOSTA_GENERICA
    }

    if (usuario.reset_token_expira) {
        const emitidoRecentemente = usuario.reset_token_expira.getTime() - VALIDADE_TOKEN_MS + COOLDOWN_REENVIO_MS > Date.now()
        if (emitidoRecentemente) {
            return RESPOSTA_GENERICA
        }
    }

    const tokenBruto = crypto.randomBytes(32).toString('hex')

    try {
        await prisma.usuarios.update({
            where: { id: usuario.id },
            data: {
                reset_token: hashToken(tokenBruto),
                reset_token_expira: new Date(Date.now() + VALIDADE_TOKEN_MS)
            }
        })

        const link = `${APP_URL}/redefinir-senha?token=${tokenBruto}`
        await enviarEmailRecuperacaoSenha(usuario.email, link)
    } catch (error) {
        console.error('Erro ao solicitar recuperação de senha:', error)
        // Não expõe detalhe do erro pro cliente - segue a mesma resposta genérica.
    }

    return RESPOSTA_GENERICA
}
