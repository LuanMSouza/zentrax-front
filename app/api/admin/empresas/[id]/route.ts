import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

export const dynamic = 'force-dynamic'

function idValido(valor: string): number | null {
    const id = Number(valor)
    return Number.isInteger(id) && id > 0 ? id : null
}

// edição rápida de empresa pelo painel (nome, plano, segmento, status,
// data de expiração). Propositalmente NÃO deixa mexer em
// stripe_customer_id/stripe_subscription_id/stripe_ciclo — esses só devem
// mudar via webhook da Stripe (ver app/api/stripe/webhook/route.ts); editar
// na mão aqui dessincronizaria o painel do que a Stripe realmente cobra.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const id = idValido((await params).id)
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })

    const data: Prisma.empresaUpdateInput = {}
    if (typeof body.nome === 'string' && body.nome.trim()) data.nome = body.nome.trim()
    if (body.segmento === 'pet' || body.segmento === 'geral') data.segmento = body.segmento
    if (typeof body.plano === 'string' && body.plano.trim()) data.plano = body.plano.trim()
    if (body.status === 'ativo' || body.status === 'inativo') data.status = body.status
    if (body.dataExpiracao === null) {
        data.data_expiracao = null
    } else if (typeof body.dataExpiracao === 'string') {
        const d = new Date(body.dataExpiracao)
        if (isNaN(d.getTime())) return NextResponse.json({ error: 'Data de expiração inválida.' }, { status: 400 })
        data.data_expiracao = d
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada pra atualizar.' }, { status: 400 })

    try {
        const empresa = await prisma.empresa.update({ where: { id }, data })
        return NextResponse.json({ ok: true, id: empresa.id })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
        }
        console.error('Erro ao atualizar empresa (admin):', error)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const id = idValido((await params).id)
    if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

    try {
        await prisma.empresa.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
            }
            // P2003: violação de FK — tem cliente/pedido/pagamento/usuário vinculado.
            // De propósito NÃO faz cascade manual aqui: apagar dado de cobrança de
            // verdade (o pai do Luan usa isso todo dia) tem que ser decisão explícita,
            // não efeito colateral de excluir a empresa errada sem querer.
            if (error.code === 'P2003') {
                return NextResponse.json({
                    error: 'Essa empresa tem clientes, pedidos ou usuários vinculados — não dá pra excluir sem apagar esses dados primeiro.',
                }, { status: 409 })
            }
        }
        console.error('Erro ao excluir empresa (admin):', error)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
