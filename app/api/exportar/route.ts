import prisma from "@/lib/prisma";
import autenticar from "@/lib/auth";
import RegistrarAcao from "@/lib/logger";
import { gerarXlsx } from "@/lib/xlsx";
import { nomeForma } from "@/lib/formas";
import { ehEmpresaDemo } from "@/lib/demo";

// Planilha com tudo da loja (clientes, notas, pagamentos). Só gestor: é o mesmo nível de acesso do "Total na rua".
// Fica registrado no Histórico quem baixou.
export async function GET() {
    const Auth = await autenticar()
    if (!Auth) return new Response('Sessão expirada', { status: 401 })
    if (Auth.role !== 'gestor') return new Response('Só gestor pode exportar os dados.', { status: 403 })
    if (await ehEmpresaDemo(Auth.empresa_id)) return new Response('Na demonstração isso fica desligado. Crie sua conta grátis para usar de verdade.', { status: 403 })

    const empresaId = Number(Auth.empresa_id)

    // uma planilha por vez no servidor: duas lojas grandes exportando juntas dobrariam o uso de CPU/RAM
    if (exportando) return new Response('Já tem uma planilha sendo gerada. Tente de novo em um minuto.', { status: 429 })
    exportando = true
    try {
        return await montarPlanilha(empresaId, Number(Auth.usuario_id))
    } finally {
        exportando = false
    }
}

let exportando = false
const LOTE = 5000

// Notas e pagamentos vêm do banco em lotes de 5000 (paginação por "data, id" > último visto), em vez de tudo de uma
// vez: com 100k notas, a lista inteira em memória era boa parte do 1,9 GB que o processo chegava a usar.
async function* notasEmLotes(empresaId: number) {
    let data = new Date('1900-01-01'), id = 0, primeira = true
    while (true) {
        const lote = await prisma.$queryRaw<any[]>`
            SELECT p.id, p.data, c.nome AS cliente, p.descricao, p.valor_inicial, p.valor_abatido,
                   p.valor_inicial - p.valor_abatido AS restante, p.vencimento
            FROM pedidos p JOIN clientes c ON c.id = p.id_cliente
            WHERE p.empresa_id = ${empresaId} AND p.data > DATE '1900-01-01'
              AND (${primeira} OR (p.data, p.id) > (${data}::date, ${id}::int))
            ORDER BY p.data, p.id
            LIMIT ${LOTE}
        `
        for (const p of lote) yield p
        if (lote.length < LOTE) return
        const ultima = lote[lote.length - 1]
        data = ultima.data; id = Number(ultima.id); primeira = false
    }
}

async function* pagamentosEmLotes(empresaId: number) {
    let data = new Date('1900-01-01'), id = 0, primeira = true
    while (true) {
        const lote = await prisma.$queryRaw<any[]>`
            SELECT g.id, g.data, r.criado_em, c.nome AS cliente, g.valor, r.forma, r.numero, r.atendente, g.nota_abatida
            FROM pagamentos g JOIN clientes c ON c.id = g.id_cliente LEFT JOIN recibos r ON r.id = g.recibo_id
            WHERE g.empresa_id = ${empresaId}
              AND (${primeira} OR (g.data, g.id) > (${data}::date, ${id}::int))
            ORDER BY g.data, g.id
            LIMIT ${LOTE}
        `
        for (const g of lote) yield g
        if (lote.length < LOTE) return
        const ultima = lote[lote.length - 1]
        data = ultima.data; id = Number(ultima.id); primeira = false
    }
}

async function* mapear<T, R>(itens: AsyncIterable<T>, f: (t: T) => R) {
    for await (const t of itens) yield f(t)
}

async function montarPlanilha(empresaId: number, usuarioId: number) {
    const clientes = await prisma.$queryRaw<any[]>`
        SELECT c.id, c.nome, c.apelido, c.whatsapp::text AS whatsapp, c.documento, c.email, c.endereco,
               c.aniversario_dia, c.aniversario_mes, c.limite_fiado, c.observacoes,
               COALESCE(SUM(p.valor_inicial - p.valor_abatido) FILTER (WHERE p.valor_inicial - p.valor_abatido > 0), 0) AS deve
        FROM clientes c LEFT JOIN pedidos p ON p.id_cliente = c.id
        WHERE c.empresa_id = ${empresaId}
        GROUP BY c.id ORDER BY c.nome
    `
    const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

    const n = (v: unknown) => (v == null ? null : Number(v))
    const xlsx = await gerarXlsx([
        {
            nome: 'Clientes',
            colunas: [
                { titulo: 'Código', largura: 9 }, { titulo: 'Nome', largura: 30 }, { titulo: 'Apelido', largura: 16 },
                { titulo: 'WhatsApp', largura: 16 }, { titulo: 'CPF/CNPJ', largura: 18 }, { titulo: 'E-mail', largura: 26 },
                { titulo: 'Endereço', largura: 32 }, { titulo: 'Aniversário', largura: 12 }, { titulo: 'Limite de fiado', largura: 15 },
                { titulo: 'Deve hoje', largura: 14 }, { titulo: 'Observações', largura: 40 },
            ],
            linhas: clientes.map(c => [
                Number(c.id), c.nome, c.apelido, c.whatsapp, c.documento, c.email, c.endereco,
                c.aniversario_dia && c.aniversario_mes ? `${String(c.aniversario_dia).padStart(2, '0')}/${String(c.aniversario_mes).padStart(2, '0')}` : null,
                { dinheiro: n(c.limite_fiado) }, { dinheiro: n(c.deve) }, c.observacoes,
            ]),
        },
        {
            nome: 'Notas',
            colunas: [
                { titulo: 'Nº da nota', largura: 11 }, { titulo: 'Data', largura: 12 }, { titulo: 'Cliente', largura: 30 },
                { titulo: 'Descrição', largura: 36 }, { titulo: 'Valor', largura: 13 }, { titulo: 'Já pago', largura: 13 },
                { titulo: 'Falta pagar', largura: 13 }, { titulo: 'Combinado pra', largura: 14 },
            ],
            linhas: mapear(notasEmLotes(empresaId), p => [
                Number(p.id), { data: p.data }, p.cliente, p.descricao,
                { dinheiro: n(p.valor_inicial) }, { dinheiro: n(p.valor_abatido) }, { dinheiro: n(p.restante) }, { data: p.vencimento },
            ]),
        },
        {
            nome: 'Pagamentos',
            colunas: [
                { titulo: 'Data', largura: 12 }, { titulo: 'Hora', largura: 8 }, { titulo: 'Cliente', largura: 30 },
                { titulo: 'Valor', largura: 13 }, { titulo: 'Forma', largura: 14 }, { titulo: 'Recibo', largura: 9 },
                { titulo: 'Atendente', largura: 18 }, { titulo: 'Nota abatida', largura: 12 },
            ],
            linhas: mapear(pagamentosEmLotes(empresaId), g => [
                { data: g.data },
                g.criado_em ? hora.format(g.criado_em) : null,
                g.cliente, { dinheiro: n(g.valor) }, g.forma ? nomeForma(g.forma) : null, n(g.numero), g.atendente, n(g.nota_abatida),
            ]),
        },
    ])

    await RegistrarAcao({ tabela: 'Clientes', operacao: 'Exportou a planilha com clientes, notas e pagamentos', empresa_id: empresaId, usuario_id: usuarioId })

    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    return new Response(new Uint8Array(xlsx), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="zentrax-${hoje}.xlsx"`,
            'Cache-Control': 'no-store',
        }
    })
}
