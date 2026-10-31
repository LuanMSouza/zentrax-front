import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { erroAutenticacaoPainel } from '@/lib/painelAuth'
import { idEmpresaDemo } from '@/lib/demo'
import { enviarEmailResumoMensal } from '@/lib/email'
import { FormatarValor } from '@/lib/mask'
import { MESES } from '@/lib/cliente'

// Endpoint interno pro cron do dia 1º: manda pro gestor de cada loja o resumo do MÊS ANTERIOR (vendido, recebido,
// comparação com o mês antes dele, quem mais pagou e quem mais deve).
//
// - Só loja ativa, fora a demo, que disse que quer receber (emails_respondido_em + resumo_mensal) e que vendeu ou recebeu algo.
// - No máximo 1 por mês por loja (empresa_settings.ultimo_resumo_mensal), mesmo se o cron rodar duas vezes.
// Body { "simular": true } só conta quem receberia, sem mandar nem marcar nada.
export const dynamic = 'force-dynamic'

const pct = (agora: number, antes: number) => {
    if (antes <= 0) return null
    const v = Math.round(((agora - antes) / antes) * 100)
    return v === 0 ? 'igual' : `${Math.abs(v)}% ${v > 0 ? 'a mais' : 'a menos'}`
}

export async function POST(request: Request) {
    const erroAuth = erroAutenticacaoPainel(request)
    if (erroAuth) return erroAuth

    const body = await request.json().catch(() => ({}))
    const simular = body?.simular === true
    const demoId = (await idEmpresaDemo()) ?? -1

    // mês anterior e o de antes dele, em datas do Brasil
    const [p] = await prisma.$queryRaw<{ inicio: Date, fim: Date, ant_inicio: Date, ant_fim: Date, este_mes: Date }[]>`
        WITH h AS (SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date AS este_mes)
        SELECT (este_mes - INTERVAL '1 month')::date AS inicio, (este_mes - 1) AS fim,
               (este_mes - INTERVAL '2 month')::date AS ant_inicio, ((este_mes - INTERVAL '1 month')::date - 1) AS ant_fim,
               este_mes
        FROM h
    `

    const empresas = await prisma.$queryRaw<{ id: number, nome: string }[]>`
        SELECT e.id, e.nome FROM empresa e LEFT JOIN empresa_settings s ON s.empresa_id = e.id
        WHERE e.status = 'ativo' AND (e.data_expiracao IS NULL OR e.data_expiracao > now()) AND e.id <> ${demoId}
          AND s.emails_respondido_em IS NOT NULL AND s.resumo_mensal
          AND (s.ultimo_resumo_mensal IS NULL OR s.ultimo_resumo_mensal < ${p.este_mes}::date)
          AND EXISTS (SELECT 1 FROM pedidos WHERE empresa_id = e.id AND data BETWEEN ${p.inicio}::date AND ${p.fim}::date
                      UNION ALL
                      SELECT 1 FROM pagamentos WHERE empresa_id = e.id AND data BETWEEN ${p.inicio}::date AND ${p.fim}::date)
    `
    if (simular) return NextResponse.json({ ok: true, simulado: true, empresas: empresas.length })

    const inicio = new Date(p.inicio)
    const mes = `${MESES[inicio.getUTCMonth()]} de ${inicio.getUTCFullYear()}`
    const link = `${process.env.APP_URL ?? 'https://app.zentrax.dvls.com.br'}/dashboard/relatorios`
    let enviados = 0

    for (const empresa of empresas) {
        const empresaId = Number(empresa.id)
        const gestor = await prisma.usuarios.findFirst({ where: { empresa_id: empresaId, role: 'gestor' }, orderBy: { id: 'asc' } })
        const email = gestor?.email || gestor?.usuario
        if (!gestor || !email?.includes('@')) continue

        // marca o mês ANTES de mandar e só segue se conseguiu marcar: duas execuções juntas não mandam em dobro
        const marcou = await prisma.$executeRaw`
            INSERT INTO empresa_settings (empresa_id, ultimo_resumo_mensal) VALUES (${empresaId}, ${p.este_mes}::date)
            ON CONFLICT (empresa_id) DO UPDATE SET ultimo_resumo_mensal = EXCLUDED.ultimo_resumo_mensal
            WHERE empresa_settings.ultimo_resumo_mensal IS NULL OR empresa_settings.ultimo_resumo_mensal < EXCLUDED.ultimo_resumo_mensal
        `
        if (!marcou) continue

        try {
            const [n] = await prisma.$queryRaw<any[]>`
                SELECT
                    (SELECT COALESCE(SUM(valor_inicial), 0) FROM pedidos WHERE empresa_id = ${empresaId} AND data BETWEEN ${p.inicio}::date AND ${p.fim}::date) AS vendido,
                    (SELECT COUNT(*) FROM pedidos WHERE empresa_id = ${empresaId} AND data BETWEEN ${p.inicio}::date AND ${p.fim}::date) AS notas,
                    (SELECT COALESCE(SUM(valor_inicial), 0) FROM pedidos WHERE empresa_id = ${empresaId} AND data BETWEEN ${p.ant_inicio}::date AND ${p.ant_fim}::date) AS vendido_antes,
                    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE empresa_id = ${empresaId} AND data BETWEEN ${p.inicio}::date AND ${p.fim}::date) AS recebido,
                    (SELECT COUNT(DISTINCT COALESCE('r' || recibo_id, 'p' || id)) FROM pagamentos WHERE empresa_id = ${empresaId} AND data BETWEEN ${p.inicio}::date AND ${p.fim}::date) AS pagamentos,
                    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE empresa_id = ${empresaId} AND data BETWEEN ${p.ant_inicio}::date AND ${p.ant_fim}::date) AS recebido_antes,
                    (SELECT COALESCE(SUM(valor_inicial - valor_abatido), 0) FROM pedidos WHERE empresa_id = ${empresaId} AND valor_inicial > valor_abatido) AS na_rua,
                    (SELECT COUNT(*) FROM (SELECT id_cliente FROM pedidos WHERE empresa_id = ${empresaId} AND data > DATE '1900-01-01'
                        GROUP BY id_cliente HAVING MIN(data) BETWEEN ${p.inicio}::date AND ${p.fim}::date) x) AS novos
            `
            const [maisDevem, maisPagaram] = await Promise.all([
                prisma.$queryRaw<{ nome: string, valor: string }[]>`
                    SELECT c.nome, SUM(p.valor_inicial - p.valor_abatido) AS valor FROM pedidos p JOIN clientes c ON c.id = p.id_cliente
                    WHERE p.empresa_id = ${empresaId} AND p.valor_inicial > p.valor_abatido
                    GROUP BY c.id ORDER BY valor DESC LIMIT 5
                `,
                prisma.$queryRaw<{ nome: string, valor: string }[]>`
                    SELECT c.nome, SUM(g.valor) AS valor FROM pagamentos g JOIN clientes c ON c.id = g.id_cliente
                    WHERE g.empresa_id = ${empresaId} AND g.data BETWEEN ${p.inicio}::date AND ${p.fim}::date
                    GROUP BY c.id ORDER BY valor DESC LIMIT 3
                `,
            ])
            const item = (l: { nome: string, valor: string }) => ({ nome: l.nome, valor: FormatarValor(Number(l.valor)) })

            await enviarEmailResumoMensal(email, gestor.nome, {
                loja: empresa.nome,
                mes,
                vendido: FormatarValor(Number(n.vendido)), notas: Number(n.notas), variacaoVendido: pct(Number(n.vendido), Number(n.vendido_antes)),
                recebido: FormatarValor(Number(n.recebido)), pagamentos: Number(n.pagamentos), variacaoRecebido: pct(Number(n.recebido), Number(n.recebido_antes)),
                naRua: FormatarValor(Number(n.na_rua)),
                clientesNovos: Number(n.novos),
                maisDevem: maisDevem.map(item),
                maisPagaram: maisPagaram.map(item),
            }, link)
            enviados++
        } catch (err) {
            console.error(`Falha no resumo mensal da empresa ${empresaId}:`, err)
        }
    }

    return NextResponse.json({ ok: true, empresas: empresas.length, enviados })
}
