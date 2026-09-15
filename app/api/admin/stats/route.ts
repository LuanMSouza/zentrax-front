import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import stripe, { PRECOS_STRIPE, type CicloAssinatura } from '@/lib/stripe'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

// Endpoint interno pro Painel (leads-back, painel de operação do Luan) puxar
// um resumo do negócio ZentraX — sem isso o painel não tem visibilidade
// nenhuma de assinantes/MRR/trials, e essa é a única informação de "outro
// produto" que ele precisa saber. Autenticado por chave compartilhada (mesmo
// esquema do webhook da Brevo no leads-back: chave fixa em header, sem sessão
// nenhuma envolvida, servidor-a-servidor). Sem PAINEL_STATS_KEY configurada,
// o endpoint fica completamente desligado (404) em vez de aberto por engano.
export const dynamic = 'force-dynamic'

// preço unitário (em centavos) de cada ciclo, direto da Stripe em vez de
// hardcoded aqui — se o preço mudar no dashboard da Stripe, o MRR calculado
// já reflete sem precisar mexer em código. Cache de 10min: essa rota pode
// ser chamada com frequência pelo painel e o preço não muda a cada request.
let precosCache: { valores: Record<CicloAssinatura, number>; expiraEm: number } | null = null

async function precoMensalEquivalente(): Promise<Record<CicloAssinatura, number>> {
    if (precosCache && precosCache.expiraEm > Date.now()) return precosCache.valores

    const [mensal, trimestral, anual] = await Promise.all(
        (['mensal', 'trimestral', 'anual'] as const).map(c => stripe.prices.retrieve(PRECOS_STRIPE[c]))
    )

    const valores: Record<CicloAssinatura, number> = {
        mensal: (mensal.unit_amount ?? 0) / 100,
        trimestral: (trimestral.unit_amount ?? 0) / 100 / 3,
        anual: (anual.unit_amount ?? 0) / 100 / 12,
    }
    precosCache = { valores, expiraEm: Date.now() + 10 * 60 * 1000 }
    return valores
}

export async function GET(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    try {
        const agora = new Date()
        const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
        const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0)
        const ha7dias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
        const ha30dias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [
            totalEmpresas, ativas, inativas, comAssinatura,
            novasHoje, novas7d, novas30d,
            expirandoEm7d, trialVencido,
            porPlano, porSegmento, totalUsuarios,
            assinantesAtivos,
        ] = await Promise.all([
            prisma.empresa.count(),
            prisma.empresa.count({ where: { status: 'ativo' } }),
            prisma.empresa.count({ where: { status: 'inativo' } }),
            prisma.empresa.count({ where: { stripe_subscription_id: { not: null } } }),
            prisma.empresa.count({ where: { created_at: { gte: hoje } } }),
            prisma.empresa.count({ where: { created_at: { gte: ha7dias } } }),
            prisma.empresa.count({ where: { created_at: { gte: ha30dias } } }),
            prisma.empresa.count({ where: { status: 'ativo', data_expiracao: { gte: agora, lte: em7dias } } }),
            // trial que acabou e nunca virou assinatura paga — o lead mais quente
            // que existe: já usou o produto de verdade e não converteu ainda
            prisma.empresa.count({ where: { status: 'ativo', stripe_subscription_id: null, data_expiracao: { lt: agora } } }),
            prisma.empresa.groupBy({ by: ['plano'], _count: { _all: true } }),
            prisma.empresa.groupBy({ by: ['segmento'], _count: { _all: true } }),
            prisma.usuarios.count(),
            prisma.empresa.findMany({
                where: { status: 'ativo', stripe_subscription_id: { not: null } },
                select: { stripe_ciclo: true },
            }),
        ])

        const precos = await precoMensalEquivalente()
        const mrr = assinantesAtivos.reduce((soma, e) => {
            const ciclo = e.stripe_ciclo as CicloAssinatura | null
            return soma + (ciclo && precos[ciclo] ? precos[ciclo] : 0)
        }, 0)

        return NextResponse.json({
            totalEmpresas,
            ativas,
            inativas,
            comAssinatura,
            emTrial: ativas - comAssinatura,
            novasHoje,
            novas7d,
            novas30d,
            expirandoEm7d,
            trialVencido,
            mrr: Math.round(mrr * 100) / 100,
            totalUsuarios,
            porPlano: porPlano.map(p => ({ plano: p.plano ?? 'sem plano', total: p._count._all })),
            porSegmento: porSegmento.map(s => ({ segmento: s.segmento ?? 'geral', total: s._count._all })),
        })
    } catch (error) {
        console.error('Erro ao gerar stats pro painel:', error)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
