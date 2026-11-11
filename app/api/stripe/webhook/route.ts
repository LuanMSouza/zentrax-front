import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import stripe from '@/lib/stripe'

// Endpoint do Stripe: eventos de assinatura mantêm empresa.status/data_expiracao
// em dia sem intervenção manual. Configurar em Dashboard > Developers > Webhooks
// (ou `stripe listen` localmente) apontando pra cá, escutando:
// checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

function statusDaAssinatura(status: Stripe.Subscription.Status): 'ativo' | 'inativo' {
    return status === 'active' || status === 'trialing' ? 'ativo' : 'inativo'
}

function periodoFinal(subscription: Stripe.Subscription): Date | null {
    const fim = subscription.items.data[0]?.current_period_end
    return fim ? new Date(fim * 1000) : null
}

// Renovação por boleto: no dia da cobrança o Stripe gera o boleto novo e a assinatura vira past_due até ele
// compensar (1-3 dias úteis). Sem folga, a loja era bloqueada no mesmo dia. Aqui ela segue ativa até
// FOLGA_DIAS depois do início do período novo; quando o boleto cai, o subscription.updated (active) põe o fim do período.
const FOLGA_DIAS = 3

function dadosDaAssinatura(subscription: Stripe.Subscription) {
    if (subscription.status === 'past_due') {
        const inicio = subscription.items.data[0]?.current_period_start
        const base = inicio ? new Date(inicio * 1000) : new Date()
        return { status: 'ativo' as const, data_expiracao: new Date(base.getTime() + FOLGA_DIAS * 24 * 60 * 60 * 1000) }
    }
    const fim = periodoFinal(subscription)
    return { status: statusDaAssinatura(subscription.status), ...(fim ? { data_expiracao: fim } : {}) }
}

export async function POST(request: Request) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Assinatura ausente.' }, { status: 400 })
    }

    let event: Stripe.Event
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (error) {
        console.error('Assinatura de webhook do Stripe inválida:', error)
        return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 })
    }

    // Idempotencia: se a Stripe reentregar o mesmo evento (retry por timeout,
    // etc), o insert falha por PK duplicada e a gente so confirma recebimento
    // sem rodar a logica de novo.
    try {
        await prisma.stripe_eventos_processados.create({
            data: { id: event.id, tipo: event.type }
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json({ received: true, duplicado: true })
        }
        console.error('Erro ao registrar evento de webhook:', error)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session

                if (session.mode !== 'subscription' || !session.subscription) break

                const empresaId = Number(session.client_reference_id)
                if (!empresaId) break

                const subscription = await stripe.subscriptions.retrieve(String(session.subscription))

                await prisma.empresa.update({
                    where: { id: empresaId },
                    data: {
                        stripe_customer_id: String(session.customer),
                        stripe_subscription_id: subscription.id,
                        stripe_ciclo: subscription.metadata?.ciclo ?? null,
                        ...dadosDaAssinatura(subscription)
                    }
                })
                break
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription

                const empresaIdMeta = Number(subscription.metadata?.empresa_id)

                const empresa = empresaIdMeta
                    ? await prisma.empresa.findUnique({ where: { id: empresaIdMeta } })
                    : await prisma.empresa.findUnique({ where: { stripe_subscription_id: subscription.id } })

                if (!empresa) break

                await prisma.empresa.update({
                    where: { id: empresa.id },
                    data: event.type === 'customer.subscription.deleted'
                        ? { status: 'inativo', ...(periodoFinal(subscription) ? { data_expiracao: periodoFinal(subscription) } : {}) }
                        : dadosDaAssinatura(subscription)
                })
                break
            }

            default:
                break
        }
    } catch (error) {
        console.error(`Erro processando webhook ${event.type}:`, error)
        // O evento foi marcado como processado ANTES de rodar a lógica. Se ela falhou, a Stripe vai reentregar (500)
        // e, com a marca, a reentrega viraria "duplicado" e o pagamento nunca seria aplicado (cliente pagou e
        // continuaria bloqueado). Desmarca pra a próxima tentativa rodar de verdade.
        await prisma.stripe_eventos_processados.delete({ where: { id: event.id } }).catch(() => {})
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}
