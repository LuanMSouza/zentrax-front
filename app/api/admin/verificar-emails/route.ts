import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'

// pro Painel (leads-back) descobrir quais dos e-mails que ele convidou pro
// ZentraX já converteram em cadastro — sem isso não tem como medir se a
// campanha de convite funciona, só quantos e-mails saíram. Recebe a lista de
// e-mails candidatos (quem foi convidado) e devolve só os que baterem, em vez
// de expor a base inteira de usuários — o Painel nunca vê e-mail de quem não
// mandou. `usuario` é o login histórico (sempre foi o e-mail) e `email` é o
// campo mais novo; casa contra os dois porque um cadastro antigo pode só ter
// o primeiro preenchido.
export const dynamic = 'force-dynamic'

const MAX_EMAILS = 3000

export async function POST(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const body = await request.json().catch(() => null)
    const emails: unknown = body?.emails

    if (!Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json({ error: 'informe "emails" (array não vazio)' }, { status: 400 })
    }
    if (emails.length > MAX_EMAILS) {
        return NextResponse.json({ error: `máximo de ${MAX_EMAILS} e-mails por chamada` }, { status: 400 })
    }

    const normalizados = [...new Set(
        emails.filter((e): e is string => typeof e === 'string' && e.length > 0).map(e => e.toLowerCase())
    )]
    if (normalizados.length === 0) return NextResponse.json([])

    const usuarios = await prisma.usuarios.findMany({
        where: {
            OR: [
                { usuario: { in: normalizados, mode: 'insensitive' } },
                { email: { in: normalizados, mode: 'insensitive' } },
            ],
        },
        select: { usuario: true, email: true, criacao: true },
    })

    const candidatos = new Set(normalizados)
    const porEmail = new Map<string, Date | null>()
    for (const u of usuarios) {
        for (const bruto of [u.usuario, u.email]) {
            if (!bruto) continue
            const email = bruto.toLowerCase()
            if (!candidatos.has(email)) continue
            const atual = porEmail.get(email)
            if (atual === undefined || (u.criacao && (!atual || u.criacao < atual))) porEmail.set(email, u.criacao)
        }
    }

    return NextResponse.json(
        [...porEmail.entries()].map(([email, criadoEm]) => ({ email, criadoEm }))
    )
}
