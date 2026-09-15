'use server'

import prisma from "@/lib/prisma";
import autenticar from "@/lib/auth";

export async function pegarClientesBack() {

    const payload = (await autenticar())!

    const empresaId = Number(payload.empresa_id);

    try {

        const emAberto = await prisma.$queryRaw<any[]>`
            SELECT 
                c.id, c.nome, c.whatsapp, c.papel_grande,
                COUNT(p.id) FILTER (WHERE p.valor_inicial - p.valor_abatido <> 0) AS quantidade_de_notas,
                COALESCE(SUM(p.valor_restante) FILTER (WHERE p.valor_restante <> 0), 0) AS total,
                MIN(p.data) FILTER (WHERE p.valor_restante <> 0) AS mais_antiga,
                MAX(p.data) FILTER (WHERE p.valor_restante <> 0) AS mais_nova
            FROM clientes c
            LEFT JOIN pedidos p ON c.id = p.id_cliente
            WHERE c.empresa_id = ${empresaId}
            GROUP BY c.id, c.nome, c.whatsapp, c.papel_grande
            HAVING COUNT(p.id) FILTER (WHERE p.valor_restante <> 0) > 0;
        `;

        // 2. Busca a lista completa de clientes (já com whatsapp e documento)
        const clientes = await prisma.clientes.findMany({
            where: { empresa_id: empresaId },
            select: { id: true, nome: true, whatsapp: true, documento: true },
            orderBy: { nome: 'asc' }
        });

        // 3. Limpeza dos dados para o Client Component (JSON Safe)
        const emAbertoLimpo = emAberto.map((item: any) => ({
            ...item,
            id: Number(item.id),
            quantidade_de_notas: Number(item.quantidade_de_notas),
            total: String(Number(item.total)), // ClienteEmAberto espera total como string
            mais_antiga: item.mais_antiga ? new Date(item.mais_antiga).toISOString() : null,
            mais_nova: item.mais_nova ? new Date(item.mais_nova).toISOString() : null,
        }));

        return {
            success: true,
            data: {
                emAberto: emAbertoLimpo,
                clientes: clientes.map(c => ({
                    ...c,
                    id: Number(c.id),
                    whatsapp: c.whatsapp ? String(c.whatsapp) : "",
                    documento: c.documento ? String(c.documento) : ""
                }))
            }
        };

    } catch (error) { // Aqui começa o catch que estava "solto"
        console.error("Erro ao buscar clientes:", error);
        return { success: false, error: "Erro ao buscar dados financeiros no servidor." };
    }
}

// Notas de um cliente especifico - usado no modal de detalhe. Evita buscar
// as notas de TODA a empresa so pra abrir o detalhe de um cliente.
export async function pegarNotasDoClienteBack(clienteId: number) {

    const payload = (await autenticar())!
    const empresaId = Number(payload.empresa_id);

    try {
        const notas = await prisma.pedidos.findMany({
            where: { empresa_id: empresaId, id_cliente: Number(clienteId) },
            orderBy: [
                { data: 'desc' },
                { id: 'desc' }
            ]
        });

        return {
            success: true,
            data: JSON.parse(JSON.stringify(notas))
        };

    } catch (error) {
        console.error("Erro ao buscar notas do cliente:", error);
        return { success: false, error: "Erro ao buscar notas do cliente no servidor." };
    }
}

const PAGAMENTOS_POR_PAGINA = 30

export async function pegarPagamentosBack(pagina: number = 1) {

    const payload = (await autenticar())!
    const empresaId = Number(payload.empresa_id);

    try {

        // Busca 1 a mais que a pagina pra saber se tem proxima, sem precisar
        // de um segundo count() no banco.
        const pagamentosRaw = await prisma.pagamentos.findMany({
            where: {
                empresa_id: Number(empresaId)
            },
            orderBy: [{ data: 'desc' }, { id: 'desc' }],
            include: { clientes: true },
            skip: (pagina - 1) * PAGAMENTOS_POR_PAGINA,
            take: PAGAMENTOS_POR_PAGINA + 1,
        });

        const temMais = pagamentosRaw.length > PAGAMENTOS_POR_PAGINA
        if (temMais) pagamentosRaw.pop()

        // Um pagamento avulso que abate varias notas gera uma linha por nota
        // (uma pra cada `pedidos` quitado/abatido). Pro usuario isso e um
        // pagamento so, entao agrupamos por cliente + dia antes de exibir.
        const agrupados = new Map<string, any>();

        for (const p of pagamentosRaw) {
            const diaChave = new Date(p.data).toISOString().slice(0, 10);
            const chave = `${p.id_cliente}-${diaChave}`;
            const existente = agrupados.get(chave);

            if (existente) {
                existente.valor += Number(p.valor);
                existente.quantidade += 1;
            } else {
                agrupados.set(chave, {
                    id: p.id,
                    id_cliente: p.id_cliente,
                    empresa_id: p.empresa_id,
                    nota_abatida: p.nota_abatida,
                    data: p.data,
                    valor: Number(p.valor),
                    quantidade: 1,
                    clientes: {
                        ...p.clientes,
                        whatsapp: p.clientes.whatsapp ? String(p.clientes.whatsapp) : null
                    }
                });
            }
        }

        const pagamentos = Array.from(agrupados.values());

        return {
            success: true,
            pagamentos,
            temMais,
            pagina
        }
    } catch (error) {
        console.error("Erro ao buscar pagamentos:", error);
        return {
            success: false,
            error: "Erro ao buscar pagamentos no servidor."
        }

    }

}