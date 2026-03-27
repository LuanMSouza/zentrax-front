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
            total: Number(item.total), // Converte Decimal para Number aqui!
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

export async function pegarNotasBack() {

    const payload = (await autenticar())!
    const empresaId = Number(payload.empresa_id);

    try {
        const notas = await prisma.pedidos.findMany({
            where: { empresa_id: empresaId },
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
        console.error("Erro ao buscar notas:", error);
        return { success: false, error: "Erro ao buscar notas no servidor." };
    }
}

export async function pegarPagamentosBack() {

    const payload = (await autenticar())!
    const empresaId = Number(payload.empresa_id);

    try {

        const pagamentosRaw = await prisma.pagamentos.findMany({
            where: {
                empresa_id: Number(empresaId)
            },
            orderBy: { data: 'desc', id: 'desc' },
            include: { clientes: true }
        });

        const pagamentos = pagamentosRaw.map(p => ({
            ...p,
            valor: Number(p.valor),
            clientes: {
                ...p.clientes,
                whatsapp: p.clientes.whatsapp ? String(p.clientes.whatsapp) : null
            }
        }));

        return {
            success: true,
            pagamentos
        }
    } catch (error) {

        return {
            success: false,
            error
        }

    }

}