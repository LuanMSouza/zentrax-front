// Juros por atraso (opcional, ligado em Configurações > Preferências). Só INFORMA: a ficha, a cobrança e o link do
// extrato mostram quanto fica com juros, mas a nota continua valendo o mesmo e o pagamento é registrado como sempre.
// Vale pra tela e pro servidor (não importa nada do banco).

export type ConfigJuros = {
    ativo: boolean
    mes: number      // % ao mês, proporcional aos dias (1% ao mês = 0,033% ao dia)
    multa: number    // % uma vez só, quando atrasa
    carencia: number // dias de tolerância depois do vencimento antes de cobrar qualquer coisa
}

export const JUROS_DESLIGADO: ConfigJuros = { ativo: false, mes: 0, multa: 0, carencia: 0 }

// limites do formulário (o banco tem CHECK com os mesmos números)
export const MAX_JUROS_MES = 20
export const MAX_MULTA = 20
export const MAX_CARENCIA = 90

const DIA_MS = 86_400_000

// data só-dia (AAAA-MM-DD ou Date do banco, que vem em UTC 00:00) → número de dias, pra subtrair sem fuso
function diaNumero(valor: Date | string) {
    return Math.floor(new Date(valor).getTime() / DIA_MS)
}

// Mesma regra de "atrasado" do dashboard: passou do dia combinado; sem dia combinado, 30 dias depois da venda.
export function diasDeAtraso(nota: { data: Date | string, vencimento?: Date | string | null }, hoje: Date | string) {
    const inicio = nota.vencimento ? diaNumero(nota.vencimento) : diaNumero(nota.data) + 30
    return Math.max(0, diaNumero(hoje) - inicio)
}

export function jurosDaNota(saldo: number, nota: { data: Date | string, vencimento?: Date | string | null }, config: ConfigJuros, hoje: Date | string) {
    if (!config.ativo || saldo <= 0) return { dias: 0, valor: 0 }
    const dias = diasDeAtraso(nota, hoje)
    if (dias === 0 || dias <= config.carencia) return { dias, valor: 0 }
    const valor = saldo * (config.multa / 100) + saldo * (config.mes / 100) * (dias / 30)
    return { dias, valor: Math.round(valor * 100) / 100 }
}

// "hoje" no Brasil como AAAA-MM-DD (perto da meia-noite o UTC já é amanhã)
export function hojeISOBR() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

// O que vem do banco (Decimal/null, ou colunas que ainda não existem) vira uma config segura
export function configJurosDe(s: { juros_ativo?: unknown, juros_mes?: unknown, multa_atraso?: unknown, juros_carencia?: unknown } | null | undefined): ConfigJuros {
    if (!s) return JUROS_DESLIGADO
    const num = (v: unknown, max: number) => {
        const n = Number(v ?? 0)
        return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
    }
    const config = {
        ativo: s.juros_ativo === true,
        mes: num(s.juros_mes, MAX_JUROS_MES),
        multa: num(s.multa_atraso, MAX_MULTA),
        carencia: Math.round(num(s.juros_carencia, MAX_CARENCIA)),
    }
    return config.ativo && (config.mes > 0 || config.multa > 0) ? config : { ...config, ativo: false }
}
