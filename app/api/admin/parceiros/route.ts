import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'
import { APP_URL, LP_URL, comissaoMensal, criarParceiro, fimDaComissao, situacaoDaEmpresa } from '@/lib/parceiros'

// Programa de parceiros, só pro painel (x-api-key).
//   GET  -> cada parceiro com as empresas indicadas e a comissão mensal ESTIMADA (valor cheio do plano x percentual).
//   POST -> cria parceiro e devolve o link: { nome, percentual?, meses?, contato? }
// A comissão é paga por fora (Pix) conferindo o valor realmente cobrado no Stripe.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const parceiros = await prisma.parceiros.findMany({
        orderBy: { criado_em: 'desc' },
        include: {
            empresas: {
                orderBy: { created_at: 'desc' },
                select: { id: true, nome: true, created_at: true, status: true, data_expiracao: true, stripe_subscription_id: true, stripe_ciclo: true },
            },
        },
    })

    return NextResponse.json(parceiros.map(p => {
        const empresas = p.empresas.map(e => {
            const situacao = situacaoDaEmpresa(e)
            const assinante = situacao === 'ativa' && (fimDaComissao(e.created_at, p.meses) ?? new Date(0)) > new Date()
            return {
                id: e.id,
                nome: e.nome,
                cadastradaEm: e.created_at,
                situacao,
                comissionavel: assinante,
                ciclo: e.stripe_ciclo,
                comissaoMensalEstimada: assinante ? comissaoMensal(e.stripe_ciclo, p.percentual) : 0,
            }
        })
        return {
            id: p.id,
            nome: p.nome,
            codigo: p.codigo,
            link: `${LP_URL}?ref=${p.codigo}`,
            painel: `${APP_URL}/parceiro/${p.token}`,
            percentual: p.percentual,
            meses: p.meses,
            contato: p.contato,
            ativo: p.ativo,
            cadastros: empresas.length,
            assinantes: empresas.filter(e => e.situacao === 'ativa').length,
            comissaoMensalEstimada: Math.round(empresas.reduce((a, e) => a + e.comissaoMensalEstimada, 0) * 100) / 100,
            empresas,
        }
    }))
}

export async function POST(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const body = await request.json().catch(() => null)
    const nome = String(body?.nome ?? '').replace(/[<>\u0000-\u001F\u007F]/g, '').trim().slice(0, 120)
    if (!nome) return NextResponse.json({ error: 'Informe o nome do parceiro.' }, { status: 400 })

    const percentual = body?.percentual === undefined ? undefined : Number(body.percentual)
    const meses = body?.meses === undefined ? undefined : Number(body.meses)
    if (percentual !== undefined && !(Number.isInteger(percentual) && percentual >= 1 && percentual <= 100)) {
        return NextResponse.json({ error: 'Percentual deve ser um inteiro de 1 a 100.' }, { status: 400 })
    }
    if (meses !== undefined && !(Number.isInteger(meses) && meses >= 1 && meses <= 60)) {
        return NextResponse.json({ error: 'Meses deve ser um inteiro de 1 a 60.' }, { status: 400 })
    }

    const p = await criarParceiro(nome, { percentual, meses, contato: String(body?.contato ?? '').trim().slice(0, 120) })
    return NextResponse.json({ id: p.id, nome: p.nome, codigo: p.codigo, link: `${LP_URL}?ref=${p.codigo}`, painel: `${APP_URL}/parceiro/${p.token}`, percentual: p.percentual, meses: p.meses }, { status: 201 })
}
