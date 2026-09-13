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

    if (event.type !== 'checkout.session.completed') {
        return NextResponse.json({ received: true, ignorado: true })
    }

    const session = event.data.object as Stripe.Checkout.Session

    // Pagamento com cartao sempre fecha o checkout ja pago, mas confere
    // mesmo assim - fica sem custo e evita renovar em cima de um checkout
    // que fechou sem confirmar o pagamento.
    if (session.payment_status !== 'paid') {
        return NextResponse.json({ received: true, ignorado: true })
    }

    const empresaId = Number(session.metadata?.empresa_id)
    const dias = Number(session.metadata?.dias)

    if (!empresaId || !dias) {
        console.error('Webhook Stripe sem metadata esperada:', event.id)
        return NextResponse.json({ received: true, ignorado: true })
    }

    try {
        // O registro do evento processado e a renovacao da empresa andam
        // juntos numa transacao: se a renovacao falhar por qualquer motivo,
        // o evento NAO fica marcado como processado, e o proximo reenvio do
        // Stripe tenta de novo. Sem isso, uma falha no meio do caminho faria
        // a renovacao se perder pra sempre (o evento ja estaria "processado").
        await prisma.$transaction(async (tx) => {
            await tx.stripe_webhook_eventos.create({ data: { id: event.id } })

            const empresa = await tx.empresa.findUnique({ where: { id: empresaId } })
            if (!empresa) {
                console.error('Webhook Stripe: empresa não encontrada', empresaId)
                return
            }

            const baseData = empresa.data_expiracao && empresa.data_expiracao > new Date()
                ? empresa.data_expiracao
                : new Date()

            await tx.empresa.update({
                where: { id: empresaId },
                data: {
                    status: 'ativo',
                    data_expiracao: new Date(baseData.getTime() + dias * 24 * 60 * 60 * 1000),
                },
            })
        })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            // Unique constraint no id do evento = ja processado antes (Stripe reenviou)
            return NextResponse.json({ received: true, duplicado: true })
        }

        console.error('Erro ao processar webhook Stripe:', error)
        return NextResponse.json({ error: 'Erro ao processar evento' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}
