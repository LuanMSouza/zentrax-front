'use server'

import prisma from "@/lib/prisma";
import autenticar from "@/lib/auth";
import { nomeForma } from "@/lib/formas";

// Fechamento do dia: o que entrou (por forma de pagamento) e o que saiu fiado num dia, pra bater com o caixa.
// Aberto a todo usuário da loja (é quem fecha o caixa), mas só com o que aconteceu naquele dia.
// O dia é o do Brasil: um pagamento às 22h de BRT já é o dia seguinte em UTC.
export async function fechamentoDoDiaBack(dia: string) {
    const Auth = await autenticar()
    if (!Auth) return { success: false as const, error: "Sessão expirada ou inválida" }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || isNaN(Date.parse(dia))) return { success: false as const, error: "Data inválida." }

    const empresaId = Number(Auth.empresa_id)

    try {
        const [recibos, semRecibo, vendas] = await Promise.all([
            prisma.$queryRaw<{ id: number, numero: number, valor: string, forma: string, atendente: string | null, criado_em: Date, cliente: string }[]>`
                SELECT r.id, r.numero, r.valor, r.forma, r.atendente, r.criado_em, c.nome AS cliente
                FROM recibos r JOIN clientes c ON c.id = r.id_cliente
                WHERE r.empresa_id = ${empresaId}
                  AND (r.criado_em AT TIME ZONE 'America/Sao_Paulo')::date = ${dia}::date
                  AND r.estornado_em IS NULL -- pagamento desfeito não entrou no caixa
                ORDER BY r.criado_em DESC
            `,
            // pagamento sem recibo (antigo ou de importação): entra no total, mas sem forma
            prisma.$queryRaw<{ total: string | null, qtd: bigint }[]>`
                SELECT SUM(valor) AS total, COUNT(*) AS qtd FROM pagamentos
                WHERE empresa_id = ${empresaId} AND recibo_id IS NULL AND data = ${dia}::date
            `,
            prisma.$queryRaw<{ total: string | null, qtd: bigint }[]>`
                SELECT SUM(valor_inicial) AS total, COUNT(*) AS qtd FROM pedidos
                WHERE empresa_id = ${empresaId} AND data = ${dia}::date
            `,
        ])

        const porForma = new Map<string, { forma: string, nome: string, total: number, qtd: number }>()
        for (const r of recibos) {
            const atual = porForma.get(r.forma) ?? { forma: r.forma, nome: nomeForma(r.forma), total: 0, qtd: 0 }
            atual.total += Number(r.valor)
            atual.qtd += 1
            porForma.set(r.forma, atual)
        }
        const totalSemForma = Number(semRecibo[0]?.total ?? 0)
        if (totalSemForma > 0) {
            porForma.set('sem_forma', { forma: 'sem_forma', nome: 'Sem forma registrada', total: totalSemForma, qtd: Number(semRecibo[0].qtd) })
        }

        const formas = [...porForma.values()].sort((a, b) => b.total - a.total)
        return {
            success: true as const,
            dia,
            recebido: formas.reduce((acc, f) => acc + f.total, 0),
            formas,
            vendidoFiado: Number(vendas[0]?.total ?? 0),
            notasLancadas: Number(vendas[0]?.qtd ?? 0),
            pagamentos: recibos.map(r => ({
                id: Number(r.id),
                numero: Number(r.numero),
                cliente: String(r.cliente),
                valor: Number(r.valor),
                forma: nomeForma(r.forma),
                atendente: r.atendente,
                hora: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(r.criado_em),
            })),
        }
    } catch (error) {
        console.error("[fechamentoDoDiaBack]", error)
        return { success: false as const, error: "Erro ao montar o fechamento." }
    }
}
