import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

// lista de empresas pro painel gerenciar (estender prazo, editar, excluir)
// sem precisar abrir o banco na mão. ?q= filtra por nome.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const q = new URL(request.url).searchParams.get('q')?.trim()

    const empresas = await prisma.empresa.findMany({
        where: q ? { nome: { contains: q, mode: 'insensitive' } } : undefined,
        orderBy: { created_at: 'desc' },
        take: 200,
        select: {
            id: true, nome: true, segmento: true, plano: true, status: true,
            data_expiracao: true, created_at: true, stripe_subscription_id: true, stripe_ciclo: true,
        },
    })

    return NextResponse.json(empresas.map(e => ({
        id: e.id,
        nome: e.nome,
        segmento: e.segmento,
        plano: e.plano,
        status: e.status,
        dataExpiracao: e.data_expiracao,
        criadoEm: e.created_at,
        assinante: !!e.stripe_subscription_id,
        ciclo: e.stripe_ciclo,
    })))
}
