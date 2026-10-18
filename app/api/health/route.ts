import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Checagem de saúde pro painel (leads-back): só confirma que o app responde e
// alcança o banco. Antes o painel usava /api/admin/stats, que além do banco
// consulta a Stripe — com a VPS carregada passava dos 5s e o painel acusava
// "offline" sem o app estar fora. Pública e sem dado nenhum: não precisa de chave.
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        await prisma.$queryRaw`SELECT 1`
        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false }, { status: 503 })
    }
}
