'use server'

import prisma from "@/lib/prisma";
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import autenticar from "@/lib/auth";
import { any, success } from "zod";

interface ClienteSQL {
    id: number;
    nome: string;
    whatsapp: string | null;
    papel_grande: boolean;
    quantidade_de_notas: number | bigint;
    total: any;
    mais_antiga: Date | string;
    mais_nova: Date | string;
}

interface Pagamento {
    id: Number,
    data: Date,
    valor: Number,
    nome: String
}

export async function pegarClientesBack() {

    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) return { success: false, error: "Não autenticado" };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const empresaId = Number(payload.empresa_id);

        // 1. Descomentei e Tipagem correta para evitar o erro de Decimal
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

    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) return { success: false, error: "Sessão expirada." };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
        const { payload } = await jwtVerify(token, secret);
        const empresaId = Number(payload.empresa_id);

        const notas = await prisma.pedidos.findMany({
            where: { empresa_id: empresaId },
            orderBy: { data: 'desc' }
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

    try {

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) return { success: false, error: "Sessão expirada." };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback');
        const { payload } = await jwtVerify(token, secret);
        const empresaId = Number(payload.empresa_id);

        const pagamentosRaw = await prisma.pagamentos.findMany({
            where: {
                empresa_id: Number(empresaId)
            },
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