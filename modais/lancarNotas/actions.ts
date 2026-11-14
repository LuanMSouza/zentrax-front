'use server'

import autenticar from "@/lib/auth"
import RegistrarAcao from "@/lib/logger"
import { formatarDataBR, FormatarValor } from "@/lib/mask"
import prisma from "@/lib/prisma"
import { revalidatePath } from 'next/cache';
import { valorEmReais, reaisOuZero, dataValida } from "@/lib/dinheiro"
import { permitir } from "@/lib/rateLimit"


type DadosNota = {
    cliente: number | string,
    data: string,
    valor?: number | string,
    valor_total: number | string,
    descricao?: string | null,
    exta?: number | string,
    quantidade?: number | string,
    segmento?: string,
    vencimento?: string | null,
    // a tela pergunta "Lançar mesmo assim?" quando o cliente está bloqueado pra fiado; sem esse sim, o servidor recusa
    confirmouBloqueio?: boolean,
}

export async function salvarNota(dados: DadosNota) {
    const { cliente, data, valor, valor_total, descricao, exta, quantidade, segmento, vencimento } = dados ?? {} as DadosNota

    // fora do try: o redirect de sessão inválida precisa subir
    const auth = await autenticar()

    try {
        const empresaId = Number(auth.empresa_id)

        const total = valorEmReais(valor_total)
        if (!total.ok) {
            return { success: false, error: total.erro === 'Informe um valor maior que zero.' ? "O valor da nota precisa ser maior que zero." : total.erro }
        }

        const dataNota = dataValida(data)
        if (!dataNota) return { success: false, error: "Data da nota inválida." }

        // data combinada pra pagar: opcional, mas se vier tem que ser válida e não pode ser antes da venda
        const vencimentoData = vencimento ? dataValida(vencimento) : null
        if (vencimento && !vencimentoData) {
            return { success: false, error: "Data combinada inválida." }
        }
        if (vencimentoData && vencimentoData < dataNota) {
            return { success: false, error: "A data combinada pra pagar não pode ser antes da data da venda." }
        }

        // Confirma que o cliente pertence a essa empresa antes de criar a nota -
        // sem isso, dava pra anexar uma nota a um cliente de outra empresa so
        // adivinhando o id (Server Action e chamavel direto, sem passar pela UI).
        const clienteInfos = await prisma.clientes.findFirst({
            where: { id: Number(cliente) || 0, empresa_id: empresaId }
        })

        if (!clienteInfos) {
            return {
                success: false,
                error: "Cliente não encontrado."
            }
        }

        if (clienteInfos.bloqueado && dados.confirmouBloqueio !== true) {
            return { success: false, error: "Esse cliente está marcado pra não vender fiado. Abra o lançamento de novo e confirme se quiser lançar mesmo assim." }
        }

        const textoDescricao = typeof descricao === 'string' ? descricao.trim().slice(0, 255) : ''
        const qtd = Math.trunc(Number(quantidade))

        // clique duplo / dois envios iguais em 5 s: a segunda nota igual é recusada (o app roda num processo só)
        const chave = `nota:${empresaId}:${clienteInfos.id}:${total.centavos}:${data}:${textoDescricao}`
        if (!permitir(chave, 1, 5_000)) {
            return { success: false, error: "Essa nota acabou de ser lançada. Confira a lista antes de lançar de novo." }
        }

        const novaNota = await prisma.pedidos.create({
            data: {
                id_cliente: clienteInfos.id,
                data: dataNota,
                valor_unitario: reaisOuZero(valor),
                valor_inicial: total.reais,
                valor_restante: total.reais,
                // antes String(undefined) gravava o texto "undefined"
                descricao: textoDescricao || null,
                valor_extra: reaisOuZero(exta),
                quantidade: qtd >= 1 && qtd <= 1_000_000 ? qtd : 1,
                empresa_id: empresaId,
                segmento: typeof segmento === 'string' && segmento.trim() ? segmento.trim().slice(0, 20) : 'geral',
                vencimento: vencimentoData
            }
        })

        revalidatePath('/dashboard');

        const txt = `Criou uma nota para o cliente ${clienteInfos?.nome} no valor ${FormatarValor(total.reais)} e data ${formatarDataBR(data)}`;

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

    } catch (error) {
        // o erro do Prisma fica só no log do servidor (antes ia cru pro navegador, com nome de tabela e coluna)
        console.error('[salvarNota]', error);
        return {
            success: false,
            error: "Erro ao salvar a nota. Tente de novo."
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
