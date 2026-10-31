'use server'

import autenticar from "@/lib/auth"
import RegistrarAcao from "@/lib/logger"
import { formatarDataBR, FormatarValor } from "@/lib/mask"
import prisma from "@/lib/prisma"
import { revalidatePath } from 'next/cache';


export async function salvarNota(dados: any) {
    const { cliente, data, valor, valor_total, descricao, exta, quantidade, segmento, vencimento } = dados

    try {
        const auth = await autenticar()

        if (!auth) {
            return {
                success: false,
                error: "Sessão expirada ou inválida"
            }
        }

        const empresaId = Number(auth.empresa_id)
        const valorTotalNumerico = Number(valor_total)

        if (!valorTotalNumerico || valorTotalNumerico <= 0) {
            return {
                success: false,
                error: "O valor da nota precisa ser maior que zero."
            }
        }

        // data combinada pra pagar: opcional, mas se vier tem que ser válida e não pode ser antes da venda
        const vencimentoData = vencimento ? new Date(vencimento) : null
        if (vencimentoData && isNaN(vencimentoData.getTime())) {
            return { success: false, error: "Data combinada inválida." }
        }
        if (vencimentoData && vencimentoData < new Date(data)) {
            return { success: false, error: "A data combinada pra pagar não pode ser antes da data da venda." }
        }

        // Confirma que o cliente pertence a essa empresa antes de criar a nota -
        // sem isso, dava pra anexar uma nota a um cliente de outra empresa so
        // adivinhando o id (Server Action e chamavel direto, sem passar pela UI).
        const clienteInfos = await prisma.clientes.findFirst({
            where: { id: Number(cliente), empresa_id: empresaId }
        })

        if (!clienteInfos) {
            return {
                success: false,
                error: "Cliente não encontrado."
            }
        }

        const novaNota = await prisma.pedidos.create({
            data: {
                id_cliente: Number(cliente),
                data: new Date(data),
                valor_unitario: Number(valor) || 0,
                valor_inicial: valorTotalNumerico,
                valor_restante: valorTotalNumerico,
                descricao: String(descricao) || null,
                valor_extra: Number(exta) || 0,
                quantidade: Number(quantidade) || 1,
                empresa_id: empresaId,
                segmento: String(segmento),
                vencimento: vencimentoData
            }
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

// O que o lançar nota precisa saber do cliente escolhido:
// - dia do mês que ele combinou na última nota com data combinada (ex.: 10 = "paga todo dia 10"), pra já sugerir na
//   venda nova; null se ele nunca teve data combinada;
// - quanto ele deve agora e o limite de fiado, pro aviso de "passa do limite" (só aviso, não bloqueia);
// - as observações do cadastro ("não vender mais fiado" tem que aparecer antes de lançar).
export async function infoDoClienteNaNota(clienteId: number) {
    const auth = await autenticar()
    if (!auth) return null

    const empresaId = Number(auth.empresa_id)
    const [ultima, cliente, saldo] = await Promise.all([
        prisma.pedidos.findFirst({
            where: { id_cliente: Number(clienteId), empresa_id: empresaId, vencimento: { not: null } },
            orderBy: [{ data: 'desc' }, { id: 'desc' }],
            select: { vencimento: true }
        }),
        prisma.clientes.findFirst({
            where: { id: Number(clienteId), empresa_id: empresaId },
            select: { limite_fiado: true, observacoes: true, bloqueado: true }
        }),
        prisma.pedidos.aggregate({
            where: { id_cliente: Number(clienteId), empresa_id: empresaId, valor_restante: { gt: 0 } },
            _sum: { valor_restante: true }
        })
    ])

    return {
        dia: ultima?.vencimento ? ultima.vencimento.getUTCDate() : null,
        limite: cliente?.limite_fiado != null ? Number(cliente.limite_fiado) : null,
        observacoes: cliente?.observacoes ?? null,
        bloqueado: cliente?.bloqueado === true,
        deve: Number(saldo._sum.valor_restante ?? 0)
    }
}
