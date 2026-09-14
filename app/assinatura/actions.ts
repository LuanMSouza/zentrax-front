'use server'

import prisma from "@/lib/prisma"
import stripe, { PRECOS_STRIPE, ehCicloValido, CicloAssinatura } from "@/lib/stripe"
import autenticar from "@/lib/auth"
import { verify } from "jsonwebtoken"

const APP_URL = process.env.APP_URL ?? 'https://zentrax.dvls.com.br'

type CheckoutResult =
    | { success: true; data: { url: string | null } }
    | { success: false; error: string }

async function iniciarCheckout(empresaId: number, ciclo: CicloAssinatura): Promise<CheckoutResult> {
    try {
        const empresa = await prisma.empresa.findUnique({
            where: { id: empresaId },
            include: { usuarios: { where: { role: 'gestor' }, take: 1 } }
        })

        if (!empresa) {
            return { success: false, error: 'Empresa não encontrada.' }
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: PRECOS_STRIPE[ciclo], quantity: 1 }],
            customer: empresa.stripe_customer_id ?? undefined,
            customer_email: empresa.stripe_customer_id ? undefined : empresa.usuarios[0]?.usuario,
            client_reference_id: String(empresaId),
            subscription_data: { metadata: { empresa_id: String(empresaId), ciclo } },
            success_url: `${APP_URL}/dashboard?assinatura=sucesso`,
            cancel_url: `${APP_URL}/login?assinatura=cancelada`,
        })

        return { success: true, data: { url: session.url } }
    } catch (error) {
        console.error('Erro ao criar checkout Stripe:', error)
        return { success: false, error: 'Erro ao iniciar pagamento. Tente novamente.' }
    }
}

// Empresa ainda ativa (ex: renovação antecipada pelo TopBar) - passa pelo autenticar() normal.
export async function criarCheckoutBack(ciclo: string): Promise<CheckoutResult> {
    const payload = await autenticar()

    if (!ehCicloValido(ciclo)) {
        return { success: false, error: 'Ciclo de cobrança inválido.' }
    }

    return iniciarCheckout(Number(payload!.empresa_id), ciclo)
}

// Assinatura já expirou/inativa - autenticar() bloquearia o login, então usa um
// token de escopo restrito (só serve pra iniciar checkout, emitido pelo login).
export async function criarCheckoutExpiradoBack(ciclo: string, billingToken: string): Promise<CheckoutResult> {
    if (!ehCicloValido(ciclo)) {
        return { success: false, error: 'Ciclo de cobrança inválido.' }
    }

    let empresaId: number
    try {
        const decoded = verify(billingToken, process.env.JWT_SECRET!) as any
        if (decoded.purpose !== 'billing') throw new Error('token com propósito inválido')
        empresaId = Number(decoded.empresa_id)
    } catch {
        return { success: false, error: 'Sessão de pagamento expirada. Faça login novamente.' }
    }

    return iniciarCheckout(empresaId, ciclo)
}

// Portal de autoatendimento do Stripe: trocar cartão, ver faturas, cancelar.
export async function criarPortalBack(): Promise<CheckoutResult> {
    const payload = await autenticar()

    try {
        const empresa = await prisma.empresa.findUnique({
            where: { id: Number(payload!.empresa_id) }
        })

        if (!empresa?.stripe_customer_id) {
            return { success: false, error: 'Essa empresa ainda não tem assinatura paga pra gerenciar.' }
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: empresa.stripe_customer_id,
            return_url: `${APP_URL}/dashboard`,
        })

        return { success: true, data: { url: session.url } }
    } catch (error) {
        console.error('Erro ao criar portal Stripe:', error)
        return { success: false, error: 'Erro ao abrir o portal de assinatura.' }
    }
}
