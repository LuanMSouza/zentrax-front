'use server'

import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { enviarEmail } from '@/lib/email'
import { podeTentar } from '@/lib/rateLimit'

const TOKEN_VALIDADE_MINUTOS = 30
const INTERVALO_ENTRE_PEDIDOS_MS = 60 * 1000

// Resposta sempre igual, exista ou nao o e-mail, pra nao dar pra descobrir
// quais e-mails estao cadastrados so tentando redefinir a senha deles.
const RESPOSTA_GENERICA = {
    success: true,
    message: 'Se esse e-mail existir por aqui, o link chega em instantes!',
}

export async function solicitarResetSenha(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase()

    if (!email) return RESPOSTA_GENERICA

    // Nao gera novo token/e-mail se ja pediu reset pra esse e-mail no ultimo
    // minuto - evita spam de e-mail e escrita repetida no banco.
    if (!podeTentar(`reset-senha:${email}`, INTERVALO_ENTRE_PEDIDOS_MS)) {
        return RESPOSTA_GENERICA
    }

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
                    <p>Pediram pra redefinir a senha da sua conta no ZentraX. Se foi você, é só clicar abaixo:</p>
                    <p><a href="${link}">Criar nova senha</a></p>
                    <p>O link vale por ${TOKEN_VALIDADE_MINUTOS} minutos. Não foi você? Pode ignorar este e-mail.</p>
                `,
            })
        }
    } catch (error) {
        console.error('Erro ao solicitar reset de senha:', error)
    }

    return RESPOSTA_GENERICA
}
