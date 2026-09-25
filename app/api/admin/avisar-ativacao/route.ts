import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

// Régua de ativação: o painel (leads-back) chama por cron diário com dia=1 e dia=3. Acha quem criou a conta há
// 1 ou 3 dias, ainda não assinou e quase não usou o sistema (dia 1: nenhum cliente; dia 3: até 2), e pede pro
// leads-back mandar o e-mail (mesma conta Brevo). Só o resultado (quantos avisados) sai pra fora, nunca a lista.
export const dynamic = 'force-dynamic'

async function enviarAtivacao(nome: string, email: string, nomeResponsavel: string, dia: number) {
    const url = process.env.LEADS_BACK_URL
    const chave = process.env.PAINEL_STATS_KEY
    if (!url || !chave) return false
    try {
        const r = await fetch(`${url}/api/zentrax-ativacao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': chave },
            body: JSON.stringify({ nome, email, nomeResponsavel, dia }),
        })
        return r.ok
    } catch (err) {
        console.error('Falha ao disparar e-mail de ativação:', err)
        return false
    }
}

export async function POST(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const body = await request.json().catch(() => ({}))
    const dia = Number(body?.dia) === 3 ? 3 : 1

    // faixa de 24h: criada entre (dia+1) e (dia) dias atrás — cobre o "dia certo" rodando em horário fixo
    const fim = new Date()
    fim.setDate(fim.getDate() - dia)
    const inicio = new Date(fim)
    inicio.setDate(inicio.getDate() - 1)

    const empresas = await prisma.empresa.findMany({
        where: { status: 'ativo', stripe_subscription_id: null, created_at: { gte: inicio, lt: fim } },
        include: { usuarios: { where: { role: 'gestor' }, take: 1 }, _count: { select: { clientes: true } } },
    })

    const limite = dia === 1 ? 0 : 2
    let avisados = 0
    for (const empresa of empresas) {
        if (empresa._count.clientes > limite) continue
        const gestor = empresa.usuarios[0]
        const email = gestor?.email
        if (!email) continue
        if (await enviarAtivacao(empresa.nome, email, gestor.nome, dia)) avisados++
    }

    return NextResponse.json({ ok: true, dia, encontrados: empresas.length, avisados })
}
