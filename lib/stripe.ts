import Stripe from 'stripe'

let stripeClient: Stripe | null = null

// Retorna null enquanto STRIPE_SECRET_KEY nao estiver configurada no .env,
// pra quem chamar decidir o fallback (em vez de derrubar a rota com erro).
export function getStripe(): Stripe | null {
    if (!process.env.STRIPE_SECRET_KEY) return null

    if (!stripeClient) {
        stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)
    }

    return stripeClient
}
