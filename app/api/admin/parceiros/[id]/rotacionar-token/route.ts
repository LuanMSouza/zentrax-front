import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'
import { APP_URL, novoToken } from '@/lib/parceiros'

export const dynamic = 'force-dynamic'

// Gera um token novo pro painel do parceiro e invalida o link antigo na hora (use se o link vazou).
// O código de indicação (?ref=) não muda: os links já divulgados continuam valendo.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const id = Number((await params).id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

    const existe = await prisma.parceiros.findUnique({ where: { id }, select: { id: true } })
    if (!existe) return NextResponse.json({ error: 'Parceiro não encontrado.' }, { status: 404 })

    const p = await prisma.parceiros.update({ where: { id }, data: { token: novoToken() }, select: { token: true } })
    return NextResponse.json({ painel: `${APP_URL}/parceiro/${p.token}` })
}
