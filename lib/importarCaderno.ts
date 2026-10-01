// "Importar do caderno": transforma uma lista colada (uma linha por cliente) em
// clientes + saldo inicial. Usado na prévia do modal (cliente) e de novo no
// servidor na hora de gravar — o servidor nunca confia na prévia.
//
// Formatos aceitos em cada linha (o valor é sempre o ÚLTIMO número da linha):
//   Bar do Zé 320            Dona Cida - 185,50        Marcos: R$ 97
//   João 1.250,00            Ana 45.5                  Seu Antônio        (sem valor = só cadastra)
export type LinhaImportada = { linha: number; nome: string; valor: number | null; erro?: string }

export const LIMITE_LINHAS = 300

// "1.250,00" / "1250,5" / "45.5" / "320" → número; null se não for valor
export function lerValor(token: string): number | null {
    let t = token.replace(/^r\$/i, '').trim()
    if (!/^\d[\d.,]*$/.test(t)) return null
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')          // 1.250,00
    else if (/\.\d{3}(\.|$)/.test(t) && !/\.\d{1,2}$/.test(t)) t = t.replace(/\./g, '') // 1.250
    else t = t.replace(/,/g, '')                                                // 45.5 / 320
    const n = Number(t)
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export function lerLista(texto: string): LinhaImportada[] {
    const saida: LinhaImportada[] = []
    String(texto ?? '').split(/\r?\n/).forEach((bruta, i) => {
        const linha = bruta.replace(/\t/g, ' ').trim()
        if (!linha) return

        // separa o último "pedaço" que parece valor (aceita "R$ 97" com espaço)
        const m = linha.match(/^(.*?)[\s:;=\-–—|]*\s(?:r\$\s*)?([\d][\d.,]*)\s*$/i)
        let nome = linha
        let valor: number | null = null
        if (m) {
            const v = lerValor(m[2])
            if (v !== null) { nome = m[1]; valor = v }
        }
        nome = nome.replace(/[\s:;=\-–—|]+$/, '').replace(/\s+/g, ' ').trim()

        const item: LinhaImportada = { linha: i + 1, nome, valor }
        if (!nome) item.erro = 'sem nome'
        else if (nome.length > 120) item.erro = 'nome muito longo'
        else if (valor !== null && valor > 1_000_000) item.erro = 'valor alto demais, confira'
        saida.push(item)
    })
    return saida
}
