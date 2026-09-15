import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

export const dynamic = 'force-dynamic'

// "+30 dias" de um clique no painel, pra não precisar abrir o banco toda vez
// que o Luan quiser segurar um cliente de boa vontade (ou testar algo).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const id = Number((await params).id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const dias = Number.isFinite(body?.dias) && body.dias > 0 ? Math.floor(body.dias) : 30

    try {
        const empresa = await prisma.empresa.findUnique({ where: { id }, select: { data_expiracao: true } })
        if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })

        // se o prazo já venceu, conta os dias a partir de hoje (não soma em
        // cima de uma data passada); se ainda tá dentro do prazo, soma em
        // cima do que já tinha
        const agora = new Date()
        const base = empresa.data_expiracao && empresa.data_expiracao > agora ? empresa.data_expiracao : agora
        const novaData = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000)

        const atualizada = await prisma.empresa.update({
            where: { id },
            data: { data_expiracao: novaData },
        })

        return NextResponse.json({ ok: true, dataExpiracao: atualizada.data_expiracao })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
        }
        console.error('Erro ao estender prazo (admin):', error)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
