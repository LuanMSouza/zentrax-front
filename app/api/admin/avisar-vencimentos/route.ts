import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'
import { idEmpresaDemo } from '@/lib/demo'
import { enviarEmailVencimentos } from '@/lib/email'
import { FormatarValor } from '@/lib/mask'

// Endpoint interno pro cron diário (8h de Brasília, ver leads/backend/scripts/cron-avisar-vencimentos-zentrax.sh):
// manda pro gestor de cada loja quem vence hoje e quem venceu ontem sem pagar.
//
// Pra não virar spam:
// - só manda se tiver nota que vence HOJE ou venceu ONTEM. Cada nota aparece no máximo em 2 e-mails na vida dela
//   (no dia e no dia seguinte); atraso antigo não fica sendo repetido todo dia.
// - loja sem data combinada em nenhuma nota nunca recebe nada.
// - no máximo 1 por dia por loja (empresa_settings.ultimo_aviso_vencimentos), mesmo se o cron rodar duas vezes.
// - desliga em Configurações › Preferências (avisar_vencimentos).
// Body { "simular": true } só conta quem receberia, sem mandar nem marcar nada.
export const dynamic = 'force-dynamic'

type Linha = { empresa_id: number, nome: string, valor: string, hoje: boolean }

export async function POST(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const body = await request.json().catch(() => ({}))
    const simular = body?.simular === true
    const demoId = (await idEmpresaDemo()) ?? -1

    const linhas = await prisma.$queryRaw<Linha[]>`
        SELECT e.id AS empresa_id, c.nome, SUM(p.valor_restante)::text AS valor, (p.vencimento = hoje.dia) AS hoje
        FROM pedidos p
        JOIN clientes c ON c.id = p.id_cliente
        JOIN empresa e ON e.id = p.empresa_id
        LEFT JOIN empresa_settings s ON s.empresa_id = e.id
        CROSS JOIN (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS dia) hoje
        WHERE p.valor_restante > 0
          AND p.vencimento IN (hoje.dia, hoje.dia - 1)
          AND e.status = 'ativo'
          AND (e.data_expiracao IS NULL OR e.data_expiracao > now())
          AND e.id <> ${demoId}
          AND COALESCE(s.avisar_vencimentos, true)
          AND (s.ultimo_aviso_vencimentos IS NULL OR s.ultimo_aviso_vencimentos < hoje.dia)
        GROUP BY e.id, c.id, c.nome, (p.vencimento = hoje.dia)
        ORDER BY c.nome
    `

    const porEmpresa = new Map<number, Linha[]>()
    for (const l of linhas) porEmpresa.set(Number(l.empresa_id), [...(porEmpresa.get(Number(l.empresa_id)) ?? []), l])

    if (simular) return NextResponse.json({ ok: true, simulado: true, empresas: porEmpresa.size })

    const link = `${process.env.APP_URL ?? 'https://app.zentrax.dvls.com.br'}/dashboard`
    let avisados = 0

    for (const [empresaId, itens] of porEmpresa) {
        const gestor = await prisma.usuarios.findFirst({ where: { empresa_id: empresaId, role: 'gestor' }, orderBy: { id: 'asc' } })
        const email = gestor?.email || gestor?.usuario
        if (!gestor || !email?.includes('@')) continue

        // marca o dia ANTES de mandar e só segue se conseguiu marcar: duas execuções ao mesmo tempo não mandam em dobro
        const marcou = await prisma.$executeRaw`
            INSERT INTO empresa_settings (empresa_id, ultimo_aviso_vencimentos)
            VALUES (${empresaId}, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
            ON CONFLICT (empresa_id) DO UPDATE SET ultimo_aviso_vencimentos = EXCLUDED.ultimo_aviso_vencimentos
            WHERE empresa_settings.ultimo_aviso_vencimentos IS NULL
               OR empresa_settings.ultimo_aviso_vencimentos < EXCLUDED.ultimo_aviso_vencimentos
        `
        if (!marcou) continue

        const formatar = (l: Linha) => ({ nome: l.nome, valor: FormatarValor(Number(l.valor)) })
        try {
            await enviarEmailVencimentos(email, gestor.nome, itens.filter(i => i.hoje).map(formatar), itens.filter(i => !i.hoje).map(formatar), link)
            avisados++
        } catch (err) {
            console.error(`Falha ao avisar vencimentos da empresa ${empresaId}:`, err)
        }
    }

    return NextResponse.json({ ok: true, empresas: porEmpresa.size, avisados })
}
