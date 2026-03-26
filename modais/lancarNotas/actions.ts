'use server'

import autenticar from "@/lib/auth"
import RegistrarAcao from "@/lib/logger"
import { formatarDataBR, FormatarValor } from "@/lib/mask"
import prisma from "@/lib/prisma"
import { revalidatePath } from 'next/cache';


export async function salvarNota(dados: any) {
    const { cliente, data, valor, valor_total, descricao, exta, quantidade, segmento } = dados

    try {
        const auth = await autenticar()

        if (!auth) {
            return {
                success: false,
                error: "Sessão expirada ou inválida"
            }
        }

        const novaNota = await prisma.pedidos.create({
            data: {
                id_cliente: Number(cliente),
                data: new Date(data),
                valor_unitario: Number(valor) || 0,
                valor_inicial: Number(valor_total) || 0,
                descricao: String(descricao) || null,
                valor_extra: Number(exta) || 0,
                quantidade: Number(quantidade) || 1,
                empresa_id: Number(auth.empresa_id),
                segmento: String(segmento)
            }
        })

        const clienteInfos = await prisma.clientes.findFirst({
            where: { id: Number(cliente) }
        })

        revalidatePath('/dashboard');

        const txt = `Criou uma nota para o cliente ${clienteInfos?.nome} no valor ${FormatarValor(valor)} e data ${formatarDataBR(data)}`;

        await RegistrarAcao({
            tabela: 'Notas',
            operacao: txt,
            empresa_id: Number(auth.empresa_id),
            usuario_id: Number(auth.usuario_id)
        })

        return {
            success: true,
            novaNota: {
                ...novaNota,
                valor_inicial: Number(novaNota.valor_inicial),
                valor_abatido: Number(novaNota.valor_abatido),
                valor_restante: Number(novaNota.valor_restante),
                valor_extra: Number(novaNota.valor_extra),
                valor_unitario: Number(novaNota.valor_unitario),
            }
        }

    } catch (error: any) {
        console.log(error);
        return {
            success: false,
            error: error.message || "Erro interno ao salvar nota"
        }
    }
}