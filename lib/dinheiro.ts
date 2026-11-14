// Dinheiro que chega do navegador (nota, pagamento). Tudo vira CENTAVOS inteiros antes de gravar: o banco guarda
// numeric(10,2) e arredondava sozinho cada coluna, então um parcial de 33,335 virava 33,34 abatido e 66,67 restante
// (soma 100,01) e um pagamento de 0,004 virava recibo de R$ 0,00.

export const CENTAVOS_MAXIMO = 9_999_999_999 // R$ 99.999.999,99, o teto da coluna numeric(10,2)

// "10.5", 10.5 -> 1050. Recusa (null) texto com vírgula/milhar ("10,50", "1.234,56"), Infinity, NaN e vazio.
export function paraCentavos(valor: unknown): number | null {
    if (typeof valor === 'string') {
        if (!/^\s*-?\d+(\.\d+)?\s*$/.test(valor)) return null
    } else if (typeof valor !== 'number') {
        return null
    }
    const n = Number(valor)
    if (!Number.isFinite(n)) return null
    // toFixed(6) antes do round: 33.335 * 100 dá 3333.4999999 em ponto flutuante e arredondaria pra baixo
    return Math.round(Number((n * 100).toFixed(6)))
}

// Valor de nota/pagamento: de R$ 0,01 até o teto. Devolve em reais já arredondado, ou o motivo da recusa.
export function valorEmReais(valor: unknown): { ok: true, reais: number, centavos: number } | { ok: false, erro: string } {
    const c = paraCentavos(valor)
    if (c === null || c < 1) return { ok: false, erro: 'Informe um valor maior que zero.' }
    if (c > CENTAVOS_MAXIMO) return { ok: false, erro: 'Valor alto demais. O máximo é R$ 99.999.999,99.' }
    return { ok: true, reais: c / 100, centavos: c }
}

// Campo opcional (valor unitário, extra): vazio/ruim vira 0, nunca estoura a coluna
export function reaisOuZero(valor: unknown): number {
    const c = paraCentavos(valor)
    return c !== null && c > 0 && c <= CENTAVOS_MAXIMO ? c / 100 : 0
}

// Data "AAAA-MM-DD" válida (o <input type="date"> manda assim) ou null
export function dataValida(valor: unknown): Date | null {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
    const d = new Date(valor)
    return isNaN(d.getTime()) || d.getUTCFullYear() < 1900 ? null : d
}
