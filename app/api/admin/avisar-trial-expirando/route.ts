import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

// Endpoint interno pro Painel (leads-back) disparar via cron diário — acha
// quem tá a X dias do trial acabar sem ter assinado ainda e manda o aviso
// via leads-back (mesma conta Brevo do convite/boas-vindas, ver
// app/adm/onboarding-publico/route.ts pro mesmo padrão). Nunca devolve lista
// de e-mail nenhuma pro chamador — a checagem e o envio acontecem os dois
// aqui dentro, só o resultado (quantos avisados) sai pra fora.
export const dynamic = 'force-dynamic'

const DIAS_PADRAO = 2

async function enviarAvisoTrial(nome: string, email: string, nomeResponsavel: string, diasRestantes: number) {
    const url = process.env.LEADS_BACK_URL
    const chave = process.env.PAINEL_STATS_KEY
    if (!url || !chave) return false
    try {
        const r = await fetch(`${url}/api/zentrax-aviso-trial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': chave },
            body: JSON.stringify({ nome, email, nomeResponsavel, diasRestantes }),
        })
        return r.ok
    } catch (err) {
        console.error('Falha ao disparar aviso de trial:', err)
        return false
    }
}

export async function POST(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const body = await request.json().catch(() => ({}))
    const dias = Number(body?.dias) || DIAS_PADRAO

    // janela do dia inteiro (dias) a partir de agora — data_expiracao é
    // timestamp exato (criado na hora do cadastro), não meia-noite, então
    // comparar só a data exigiria truncar; em vez disso usa uma faixa de
    // 24h começando em "agora + dias", que cobre o dia certo mesmo rodando
    // em horário fixo (cron às 9h, por ex.)
    const inicio = new Date()
    inicio.setDate(inicio.getDate() + dias)
    const fim = new Date(inicio)
    fim.setDate(fim.getDate() + 1)

    const empresas = await prisma.empresa.findMany({
        where: {
            status: 'ativo',
            stripe_subscription_id: null,
            data_expiracao: { gte: inicio, lt: fim },
        },
        include: {
            usuarios: { where: { role: 'gestor' }, take: 1 },
        },
    })

    let avisados = 0
    for (const empresa of empresas) {
        const gestor = empresa.usuarios[0]
        const email = gestor?.email || gestor?.usuario
        if (!email) continue
        const ok = await enviarAvisoTrial(empresa.nome, email, gestor.nome, dias)
        if (ok) avisados++
    }

    return NextResponse.json({ ok: true, encontrados: empresas.length, avisados })
}
