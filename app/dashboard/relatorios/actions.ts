'use server'

import prisma from "@/lib/prisma";
import autenticar from "@/lib/auth";
import { pode } from "@/lib/permissoesServidor";
import { Prisma } from "@prisma/client";
import { estaSumido } from "@/lib/cliente";

export type Periodo = 'mes' | 'ano' | 'tudo'

const LIMITE = 50

// Relatórios (rankings e números da loja). Gestor, ou atendente se o gestor liberou: mesma regra do "Total na rua".
// Período "mês" e "ano" vão do dia 1 (ou 1º de janeiro) até hoje, e a comparação é com o MESMO trecho do mês/ano
// anterior (1 a 15 de outubro contra 1 a 15 de setembro), pra não comparar meio mês com um mês inteiro.
export async function relatorioBack(periodo: Periodo) {
    const Auth = await autenticar()
    if (!Auth) return { success: false as const, error: "Sessão expirada ou inválida" }
    if (!(await pode(Auth, 'relatorios'))) return { success: false as const, error: "Os relatórios são só pra gestor (ou pra quem ele liberou)." }
    if (!['mes', 'ano', 'tudo'].includes(periodo)) return { success: false as const, error: "Período inválido." }

    const empresaId = Number(Auth.empresa_id)

    // [inicio, fim] do período e do período anterior, em datas do Brasil
    const unidade = periodo === 'ano' ? 'year' : 'month'
    const [limites] = await prisma.$queryRaw<{ hoje: Date, inicio: Date, ant_inicio: Date, ant_fim: Date }[]>`
        WITH h AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS dia)
        SELECT h.dia AS hoje,
               date_trunc(${unidade}, h.dia)::date AS inicio,
               (date_trunc(${unidade}, h.dia) - ${`1 ${unidade}`}::interval)::date AS ant_inicio,
               LEAST((h.dia - ${`1 ${unidade}`}::interval)::date,
                     (date_trunc(${unidade}, h.dia) - INTERVAL '1 day')::date) AS ant_fim
        FROM h
    `
    const tudo = periodo === 'tudo'
    // nota de 0001-01-01 é lixo de importação antiga: fora de tudo
    const inicio = tudo ? new Date('1900-01-02T00:00:00Z') : limites.inicio
    const fim = limites.hoje

    const noPeriodo = (coluna: Prisma.Sql) => Prisma.sql`${coluna} BETWEEN ${inicio}::date AND ${fim}::date`

    try {
        const [maisComprou, maisPagou, melhorPagador, maisDeve, frequencia, totais] = await Promise.all([
            prisma.$queryRaw<any[]>`
                SELECT c.id, c.nome, c.apelido, SUM(p.valor_inicial) AS valor, COUNT(*) AS notas
                FROM pedidos p JOIN clientes c ON c.id = p.id_cliente
                WHERE p.empresa_id = ${empresaId} AND ${noPeriodo(Prisma.sql`p.data`)}
                GROUP BY c.id ORDER BY valor DESC LIMIT ${LIMITE}
            `,
            // "Tudo" soma o abatido das notas (inclui pagamento de antes do histórico, que não tem data); mês e ano
            // precisam da data do pagamento, então vêm da tabela de pagamentos
            tudo
                ? prisma.$queryRaw<any[]>`
                    SELECT c.id, c.nome, c.apelido, SUM(p.valor_abatido) AS valor, COUNT(*) FILTER (WHERE p.valor_restante <= 0) AS notas
                    FROM pedidos p JOIN clientes c ON c.id = p.id_cliente
                    WHERE p.empresa_id = ${empresaId} AND p.data > DATE '1900-01-01'
                    GROUP BY c.id HAVING SUM(p.valor_abatido) > 0 ORDER BY valor DESC LIMIT ${LIMITE}
                `
                : prisma.$queryRaw<any[]>`
                    SELECT c.id, c.nome, c.apelido, SUM(g.valor) AS valor, COUNT(DISTINCT COALESCE('r' || g.recibo_id, 'd' || g.data)) AS pagamentos
                    FROM pagamentos g JOIN clientes c ON c.id = g.id_cliente
                    WHERE g.empresa_id = ${empresaId} AND ${noPeriodo(Prisma.sql`g.data`)}
                    GROUP BY c.id ORDER BY valor DESC LIMIT ${LIMITE}
                `,
            // média de dias entre a nota (vendida no período) e o pagamento que a quitou; precisa de 2+ notas medidas
            prisma.$queryRaw<any[]>`
                WITH q AS (
                    SELECT p.id_cliente, GREATEST(MAX(g.data) - p.data, 0) AS dias
                    FROM pedidos p JOIN pagamentos g ON g.nota_abatida = p.id
                    WHERE p.empresa_id = ${empresaId} AND p.valor_restante <= 0 AND ${noPeriodo(Prisma.sql`p.data`)}
                    GROUP BY p.id, p.id_cliente, p.data
                )
                SELECT c.id, c.nome, c.apelido, AVG(q.dias) AS media, MAX(q.dias) AS maior, COUNT(*) AS notas
                FROM q JOIN clientes c ON c.id = q.id_cliente
                GROUP BY c.id HAVING COUNT(*) >= 2
                ORDER BY media ASC, notas DESC LIMIT ${LIMITE}
            `,
            // dívida é de agora, não depende do período
            prisma.$queryRaw<any[]>`
                SELECT c.id, c.nome, c.apelido, SUM(p.valor_restante) AS valor, COUNT(*) AS notas, MIN(p.data) AS mais_antiga
                FROM pedidos p JOIN clientes c ON c.id = p.id_cliente
                WHERE p.empresa_id = ${empresaId} AND p.valor_restante > 0
                GROUP BY c.id ORDER BY valor DESC LIMIT ${LIMITE}
            `,
            // sumidos: intervalo médio entre os últimos 10 dias de compra; quem não compra há mais de um ano fica fora
            prisma.$queryRaw<any[]>`
                WITH d AS (
                    SELECT DISTINCT id_cliente, data FROM pedidos
                    WHERE empresa_id = ${empresaId} AND data > DATE '1900-01-01'
                ), r AS (
                    SELECT id_cliente, data, ROW_NUMBER() OVER (PARTITION BY id_cliente ORDER BY data DESC) AS ordem FROM d
                ), f AS (
                    SELECT id_cliente, MAX(data) AS ultima, COUNT(*) AS dias_com_compra,
                           (MAX(data) - MIN(data))::float / NULLIF(COUNT(*) - 1, 0) AS intervalo
                    FROM r WHERE ordem <= 10 GROUP BY id_cliente HAVING COUNT(*) >= 3
                )
                SELECT c.id, c.nome, c.apelido, c.whatsapp, f.ultima, f.intervalo, ${fim}::date - f.ultima AS dias_sem_comprar,
                       (SELECT COALESCE(SUM(valor_restante), 0) FROM pedidos WHERE id_cliente = c.id AND valor_restante > 0) AS deve
                FROM f JOIN clientes c ON c.id = f.id_cliente
                WHERE c.empresa_id = ${empresaId} AND ${fim}::date - f.ultima <= 365
            `,
            tudo ? Promise.resolve(null) : prisma.$queryRaw<any[]>`
                SELECT
                    (SELECT COALESCE(SUM(valor_inicial), 0) FROM pedidos WHERE empresa_id = ${empresaId} AND data BETWEEN ${inicio}::date AND ${fim}::date) AS vendido,
                    (SELECT COALESCE(SUM(valor_inicial), 0) FROM pedidos WHERE empresa_id = ${empresaId} AND data BETWEEN ${limites.ant_inicio}::date AND ${limites.ant_fim}::date) AS vendido_antes,
                    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE empresa_id = ${empresaId} AND data BETWEEN ${inicio}::date AND ${fim}::date) AS recebido,
                    (SELECT COALESCE(SUM(valor), 0) FROM pagamentos WHERE empresa_id = ${empresaId} AND data BETWEEN ${limites.ant_inicio}::date AND ${limites.ant_fim}::date) AS recebido_antes
            `,
        ])

        const base = (l: any) => ({ id: Number(l.id), nome: String(l.nome), apelido: l.apelido ?? null })
        const n = (v: any) => (v == null ? null : Number(v))

        const sumidos = frequencia
            .map(l => ({ ...base(l), whatsapp: l.whatsapp ? String(l.whatsapp) : null, intervalo: Number(l.intervalo), diasSemComprar: Number(l.dias_sem_comprar), ultima: new Date(l.ultima).toISOString(), deve: Number(l.deve) }))
            .filter(l => estaSumido(l.intervalo, l.diasSemComprar))
            // quem sumiu há menos tempo primeiro: é o que ainda dá pra trazer de volta
            .sort((a, b) => a.diasSemComprar - b.diasSemComprar)
            .slice(0, LIMITE)

        let totaisLimpos = null
        if (totais) {
            const t = totais[0]
            // sem "antes" não tem comparação (loja nova): null em vez de +100% ou divisão por zero
            const variacao = (agora: number, antes: number) => (antes > 0 ? (agora - antes) / antes : null)
            totaisLimpos = {
                vendido: Number(t.vendido),
                recebido: Number(t.recebido),
                variacaoVendido: variacao(Number(t.vendido), Number(t.vendido_antes)),
                variacaoRecebido: variacao(Number(t.recebido), Number(t.recebido_antes)),
            }
        }

        return {
            success: true as const,
            periodo,
            inicio: tudo ? null : new Date(inicio).toISOString(),
            fim: new Date(fim).toISOString(),
            totais: totaisLimpos,
            maisComprou: maisComprou.map(l => ({ ...base(l), valor: Number(l.valor), notas: Number(l.notas) })),
            maisPagou: maisPagou.map(l => ({ ...base(l), valor: Number(l.valor), quantidade: n(l.notas ?? l.pagamentos) ?? 0 })),
            melhorPagador: melhorPagador.map(l => ({ ...base(l), media: Number(l.media), maior: Number(l.maior), notas: Number(l.notas) })),
            maisDeve: maisDeve.map(l => ({ ...base(l), valor: Number(l.valor), notas: Number(l.notas), maisAntiga: new Date(l.mais_antiga).toISOString() })),
            sumidos,
        }
    } catch (error) {
        console.error("[relatorioBack]", error)
        return { success: false as const, error: "Erro ao montar os relatórios." }
    }
}
