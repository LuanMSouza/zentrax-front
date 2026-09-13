export type PlanoId = 'mensal' | 'trimestral' | 'anual'

export const PLANOS: Record<PlanoId, { nome: string; dias: number; valorCentavos: number }> = {
    mensal: {
        nome: 'Mensal',
        dias: Number(process.env.STRIPE_PLANO_MENSAL_DIAS ?? 30),
        valorCentavos: Number(process.env.STRIPE_PLANO_MENSAL_CENTAVOS ?? 4990),
    },
    trimestral: {
        nome: 'Trimestral',
        dias: Number(process.env.STRIPE_PLANO_TRIMESTRAL_DIAS ?? 90),
        valorCentavos: Number(process.env.STRIPE_PLANO_TRIMESTRAL_CENTAVOS ?? 13490),
    },
    anual: {
        nome: 'Anual',
        dias: Number(process.env.STRIPE_PLANO_ANUAL_DIAS ?? 365),
        valorCentavos: Number(process.env.STRIPE_PLANO_ANUAL_CENTAVOS ?? 47990),
    },
}
