import prisma from './prisma'

// Programa de indicação: quem indica ganha 1 mês grátis por empresa indicada
// que criar conta (regra combinada com o Luan em 2026-09-25).
//
// - Trial (sem assinatura Stripe): soma DIAS_POR_INDICACAO em data_expiracao.
// - Assinante Stripe: o webhook do Stripe reescreve data_expiracao com o fim
//   do período pago, então somar aqui seria desfeito na próxima renovação. O
//   crédito fica registrado como `credito_pendente` pra ser aplicado no Stripe
//   (ex.: saldo do cliente) sem se perder.
// - Teto de MAX_INDICACOES_CREDITADAS por empresa, contra cadastro falso em
//   série. Indicar a si mesmo (mesmo e-mail de gestor) não conta.
export const DIAS_POR_INDICACAO = 30
export const MAX_INDICACOES_CREDITADAS = 12

// sem 0/O/1/I/L pra ninguém errar ao ditar o código
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function gerarCodigo(): string {
    let c = ''
    for (let i = 0; i < 8; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]
    return c
}

export async function garantirCodigo(empresaId: number): Promise<string> {
    const atual = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { codigo_indicacao: true } })
    if (atual?.codigo_indicacao) return atual.codigo_indicacao

    for (let tentativa = 0; tentativa < 5; tentativa++) {
        try {
            const r = await prisma.empresa.update({
                where: { id: empresaId },
                data: { codigo_indicacao: gerarCodigo() },
                select: { codigo_indicacao: true },
            })
            return r.codigo_indicacao!
        } catch (e: any) {
            if (e?.code !== 'P2002') throw e // só repete se o código colidiu
        }
    }
    throw new Error('Não foi possível gerar o código de indicação.')
}

export function codigoValido(v: unknown): string | null {
    const c = String(v ?? '').trim().toUpperCase()
    return /^[A-Z0-9]{4,12}$/.test(c) ? c : null
}

// chamado DEPOIS de criar a empresa nova; nunca deve derrubar o cadastro
export async function registrarIndicacao(codigo: string, novaEmpresaId: number, emailNovo: string) {
    const indicador = await prisma.empresa.findUnique({
        where: { codigo_indicacao: codigo },
        select: {
            id: true, data_expiracao: true, stripe_subscription_id: true,
            usuarios: { where: { role: 'gestor' }, select: { email: true } },
        },
    })
    if (!indicador || indicador.id === novaEmpresaId) return { ok: false as const, motivo: 'codigo_desconhecido' }

    const emailsIndicador = indicador.usuarios.map(u => (u.email ?? '').toLowerCase())
    if (emailsIndicador.includes(emailNovo.toLowerCase())) return { ok: false as const, motivo: 'auto_indicacao' }

    const jaCreditadas = await prisma.indicacoes.count({ where: { indicador_id: indicador.id } })
    const dentroDoTeto = jaCreditadas < MAX_INDICACOES_CREDITADAS
    const assinante = !!indicador.stripe_subscription_id

    await prisma.$transaction(async (tx) => {
        await tx.indicacoes.create({
            data: {
                indicador_id: indicador.id,
                indicada_id: novaEmpresaId,
                dias_creditados: dentroDoTeto && !assinante ? DIAS_POR_INDICACAO : 0,
                credito_pendente: dentroDoTeto && assinante,
            },
        })
        if (dentroDoTeto && !assinante) {
            const agora = new Date()
            const base = indicador.data_expiracao && indicador.data_expiracao > agora ? indicador.data_expiracao : agora
            await tx.empresa.update({
                where: { id: indicador.id },
                data: { data_expiracao: new Date(base.getTime() + DIAS_POR_INDICACAO * 24 * 60 * 60 * 1000) },
            })
        }
    })
    return { ok: true as const, creditado: dentroDoTeto, pendente: dentroDoTeto && assinante }
}

export async function resumoIndicacao(empresaId: number) {
    const codigo = await garantirCodigo(empresaId)
    const lista = await prisma.indicacoes.findMany({ where: { indicador_id: empresaId }, select: { dias_creditados: true, credito_pendente: true } })
    return {
        codigo,
        indicadas: lista.length,
        mesesGanhos: Math.round(lista.reduce((a, i) => a + i.dias_creditados, 0) / DIAS_POR_INDICACAO),
        creditosPendentes: lista.filter(i => i.credito_pendente).length,
        maximo: MAX_INDICACOES_CREDITADAS,
    }
}
