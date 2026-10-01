import stripe from '@/lib/stripe'

// Preço de fundador: os 10 primeiros assinantes do plano MENSAL pagam R$ 29,90/mês
// pra sempre (cupom de R$ 20 de desconto, duration=forever, max_redemptions=10,
// criado direto no Stripe em 2026-10-01). O Stripe é a fonte da verdade das vagas:
// times_redeemed conta sozinho e o cupom vira inválido quando acaba.
export const CUPOM_FUNDADOR = process.env.STRIPE_CUPOM_FUNDADOR ?? 'FUNDADOR'
export const PRECO_FUNDADOR = 'R$ 29,90'

let cache: { vagas: number; em: number } | null = null

export async function vagasFundador(): Promise<number> {
    if (cache && Date.now() - cache.em < 60_000) return cache.vagas
    try {
        const c = await stripe.coupons.retrieve(CUPOM_FUNDADOR)
        const vagas = c.valid ? Math.max(0, (c.max_redemptions ?? 0) - c.times_redeemed) : 0
        cache = { vagas, em: Date.now() }
        return vagas
    } catch {
        // cupom apagado / Stripe fora: sem oferta, checkout segue no preço cheio
        return 0
    }
}
