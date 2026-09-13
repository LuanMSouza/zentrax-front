'use server'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { enviarEmail } from '@/lib/email'

const TOKEN_VALIDADE_MINUTOS = 30

// Resposta sempre igual, exista ou nao o e-mail, pra nao dar pra descobrir
// quais e-mails estao cadastrados so tentando redefinir a senha deles.
const RESPOSTA_GENERICA = {
    success: true,
    message: 'Se esse e-mail estiver cadastrado, você vai receber um link para redefinir sua senha em instantes.',
}

export async function solicitarResetSenha(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!email) return RESPOSTA_GENERICA

    try {
        const usuario = await prisma.usuarios.findFirst({
            where: { usuario: { equals: email, mode: 'insensitive' } },
        })

        if (usuario) {
            const tokenBruto = crypto.randomBytes(32).toString('hex')
            const tokenHash = crypto.createHash('sha256').update(tokenBruto).digest('hex')

            await prisma.usuarios.update({
                where: { id: usuario.id },
                data: {
                    reset_token_hash: tokenHash,
                    reset_token_expira: new Date(Date.now() + TOKEN_VALIDADE_MINUTOS * 60 * 1000),
                },
            })

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zentrax.dvls.com.br'
            const link = `${baseUrl}/redefinir-senha?token=${tokenBruto}`

            await enviarEmail({
                to: usuario.usuario,
                subject: 'Redefinição de senha — ZentraX',
                html: `
                    <p>Olá, ${usuario.nome}!</p>
                    <p>Recebemos um pedido para redefinir sua senha no ZentraX.</p>
                    <p><a href="${link}">Clique aqui para criar uma nova senha</a></p>
                    <p>Esse link expira em ${TOKEN_VALIDADE_MINUTOS} minutos. Se você não pediu isso, é só ignorar este e-mail.</p>
                `,
            })
        }
    } catch (error) {
        console.error('Erro ao solicitar reset de senha:', error)
    }

    return RESPOSTA_GENERICA
}
