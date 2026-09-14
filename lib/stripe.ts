import Stripe from 'stripe'

// Inicialização preguiçosa: o SDK do Stripe lança erro assim que é
// instanciado sem apiKey, o que derrubava o build inteiro (next build
// importa as rotas pra coletar metadados, mesmo sem executá-las) em
// qualquer ambiente sem STRIPE_SECRET_KEY configurada ainda.
let stripeSingleton: Stripe | null = null

function getStripe(): Stripe {
    if (!stripeSingleton) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY não configurada.')
        }
        stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY)
    }
    return stripeSingleton
}

const stripe = new Proxy({} as Stripe, {
    get(_target, prop, receiver) {
        return Reflect.get(getStripe(), prop, receiver)
    }
})

export default stripe

export type CicloAssinatura = 'mensal' | 'trimestral' | 'anual'

export const PRECOS_STRIPE: Record<CicloAssinatura, string> = {
    mensal: process.env.STRIPE_PRICE_MENSAL!,
    trimestral: process.env.STRIPE_PRICE_TRIMESTRAL!,
    anual: process.env.STRIPE_PRICE_ANUAL!,
}

export function ehCicloValido(valor: string): valor is CicloAssinatura {
    return valor === 'mensal' || valor === 'trimestral' || valor === 'anual'
}
