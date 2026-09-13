import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import prisma from '@/lib/prisma'

// Recebe os eventos do Stripe (checkout.session.completed) e estende a
// data_expiracao da empresa. So fica ativo quando STRIPE_SECRET_KEY e
// STRIPE_WEBHOOK_SECRET estiverem configurados no .env.
export async function POST(request: Request) {
    const stripe = getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripe || !webhookSecret) {
        return NextResponse.json({ error: 'Stripe não configurado' }, { status: 503 })
    }

    const signature = request.headers.get('stripe-signature')
    const body = await request.text()

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature ?? '', webhookSecret)
    } catch (error) {
        console.error('Assinatura de webhook Stripe inválida:', error)
        return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
    }

    try {
        await prisma.stripe_webhook_eventos.create({ data: { id: event.id } })
    } catch {
        // Unique constraint = evento ja processado antes (Stripe reenviou).
        // Responde 200 pra ele parar de tentar de novo, sem reaplicar a renovacao.
        return NextResponse.json({ received: true, duplicado: true })
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const empresaId = Number(session.metadata?.empresa_id)
        const dias = Number(session.metadata?.dias)

        if (empresaId && dias) {
            const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })

            if (empresa) {
                const baseData = empresa.data_expiracao && empresa.data_expiracao > new Date()
                    ? empresa.data_expiracao
                    : new Date()

                await prisma.empresa.update({
                    where: { id: empresaId },
                    data: {
                        status: 'ativo',
                        data_expiracao: new Date(baseData.getTime() + dias * 24 * 60 * 60 * 1000),
                    },
                })
            }
        }
    }

    return NextResponse.json({ received: true })
}
