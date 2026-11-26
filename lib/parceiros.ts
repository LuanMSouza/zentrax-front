import prisma from './prisma'

// Programa de parceiros: indicação EXTERNA com comissão em dinheiro (contador, consultor, outra empresa).
// Diferente de lib/indicacao.ts, que premia cliente do ZentraX com mês grátis. Os dois usam o mesmo link
// (?ref=CODIGO): se o código é de um parceiro, a empresa nova fica ligada a ele; senão cai no fluxo de cliente.
export const PERCENTUAL_PADRAO = 30
export const MESES_PADRAO = 12

// valor cheio de cada cobrança (modais/assinatura/pages.tsx). Base da estimativa de comissão: o valor real
// cobrado (ex.: preço promocional) está no Stripe, e o pagamento ao parceiro deve conferir lá.
export const PRECO_CICLO: Record<string, { valor: number; meses: number }> = {
    mensal: { valor: 49.9, meses: 1 },
    trimestral: { valor: 134.7, meses: 3 },
    anual: { valor: 358.8, meses: 12 },
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function gerarCodigo(): string {
    let c = ''
    for (let i = 0; i < 6; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
    return c
}

// chamado DEPOIS de criar a empresa nova. Retorna true se o código era de um parceiro (aí o fluxo de indicação
// de cliente não roda). Nunca deve derrubar o cadastro: quem chama trata a exceção.
export async function registrarParceiro(codigo: string, novaEmpresaId: number): Promise<boolean> {
    const parceiro = await prisma.parceiros.findUnique({ where: { codigo }, select: { id: true, ativo: true } })
    if (!parceiro) return false
    if (parceiro.ativo) {
        await prisma.empresa.update({ where: { id: novaEmpresaId }, data: { parceiro_id: parceiro.id } })
    }
    return true
}

export async function criarParceiro(nome: string, opts: { percentual?: number; meses?: number; contato?: string } = {}) {
    for (let tentativa = 0; tentativa < 5; tentativa++) {
        try {
            return await prisma.parceiros.create({
                data: {
                    nome,
                    codigo: gerarCodigo(),
                    percentual: opts.percentual ?? PERCENTUAL_PADRAO,
                    meses: opts.meses ?? MESES_PADRAO,
                    contato: opts.contato || null,
                },
            })
        } catch (e: any) {
            if (e?.code !== 'P2002') throw e // só repete se o código colidiu
        }
    }
    throw new Error('Não foi possível gerar o código do parceiro.')
}

// comissão por mês de uma empresa indicada: mensalidade equivalente x percentual
export function comissaoMensal(ciclo: string | null, percentual: number): number {
    const p = ciclo ? PRECO_CICLO[ciclo] : undefined
    if (!p) return 0
    return Math.round((p.valor / p.meses) * percentual) / 100
}
