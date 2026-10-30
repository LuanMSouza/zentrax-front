import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Checagem de saúde pro painel (leads-back) e pro monitor de 5 em 5 min (_ops/monitor.js).
// Lê 1 linha de cada tabela do dia a dia (todas as colunas, como o app faz): se o código
// esperar uma coluna que o banco não tem (deploy antes da migração, como em 29/10/26,
// quando o login ficou fora ~25h), responde 503 e o monitor manda o alerta.
// Rápida (findFirst por chave) e pública sem dado nenhum: não precisa de chave.
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        await Promise.all([
            prisma.usuarios.findFirst(),
            prisma.empresa.findFirst(),
            prisma.empresa_settings.findFirst(),
            prisma.clientes.findFirst(),
            prisma.pedidos.findFirst(),
            prisma.pagamentos.findFirst(),
        ])
        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error('health falhou:', e instanceof Error ? e.message.split('\n').filter(Boolean).slice(-1)[0] : e)
        return NextResponse.json({ ok: false }, { status: 503 })
    }
}
