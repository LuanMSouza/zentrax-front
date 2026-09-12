'use server'

import prisma from "@/lib/prisma"
import autenticar from "@/lib/auth"
import RegistrarAcao from "@/lib/logger"

type AlterarClienteProps = {
    id: number,
    nome: string,
    whatsapp: string,
    documento: string
}

export async function AlterarClienteBack(dados: AlterarClienteProps) {
    const Auth = await autenticar()

    if (!Auth) {
        return { success: false, error: "Sessão expirada ou inválida" }
    }

    const empresaId = Number(Auth.empresa_id)
    const id = Number(dados.id)
    const nome = String(dados.nome ?? '').trim()

    if (!nome) {
        return { success: false, error: "O nome é obrigatório." }
    }

    // Confirma que o cliente pertence a essa empresa antes de alterar.
    const alvo = await prisma.clientes.findUnique({ where: { id } })

    if (!alvo || alvo.empresa_id !== empresaId) {
        return { success: false, error: "Cliente não encontrado." }
    }

    // Aceita whatsapp com espacos/tracos, filtrando so os digitos.
    const whatsappDigitos = String(dados.whatsapp ?? '').replace(/\D/g, '')
    const documento = String(dados.documento ?? '').trim()

    const condicoes: any[] = [{ nome }];
    if (documento) {
        condicoes.push({ documento });
    }

    const jaExiste = await prisma.clientes.findFirst({
        where: {
            id: { not: id },
            empresa_id: empresaId,
            OR: condicoes
        }
    })

    if (jaExiste) {
        return { success: false, error: 'Já existe outro cliente com esse nome ou documento.' }
    }

    try {
        const clienteAtualizado = await prisma.clientes.update({
            where: { id },
            data: {
                nome,
                whatsapp: whatsappDigitos ? BigInt(whatsappDigitos) : null,
                documento: documento || null
            }
        })

        await RegistrarAcao({
            tabela: 'Clientes',
            operacao: `Alterou os dados do cliente ${nome}`,
            empresa_id: empresaId,
            usuario_id: Number(Auth.usuario_id)
        })

        return {
            success: true,
            clienteAtualizado: {
                id: clienteAtualizado.id,
                nome: clienteAtualizado.nome,
                whatsapp: clienteAtualizado.whatsapp ? String(clienteAtualizado.whatsapp) : "",
                documento: clienteAtualizado.documento ?? ""
            }
        }

    } catch (error) {
        console.error("Erro ao alterar cliente:", error)
        return { success: false, error: "Erro ao atualizar o cliente." }
    }
}

export async function PegarImpactoClienteBack(id: number) {
    const Auth = await autenticar()

    if (!Auth) {
        return { success: false, error: "Sessão expirada ou inválida" }
    }

    const empresaId = Number(Auth.empresa_id)
    const clienteId = Number(id)

    const cliente = await prisma.clientes.findUnique({
        where: { id: clienteId },
        include: {
            _count: { select: { pedidos: true, pagamentos: true } }
        }
    })

    if (!cliente || cliente.empresa_id !== empresaId) {
        return { success: false, error: "Cliente não encontrado." }
    }

    return {
        success: true,
        quantidadeNotas: cliente._count.pedidos,
        quantidadePagamentos: cliente._count.pagamentos
    }
}

export async function ApagarClienteBack(id: number) {
    const Auth = await autenticar()

    if (!Auth) {
        return { success: false, error: "Sessão expirada ou inválida" }
    }

    if (Auth.role !== 'gestor') {
        return { success: false, error: "Apenas gestores podem excluir clientes." }
    }

    const empresaId = Number(Auth.empresa_id)
    const clienteId = Number(id)

    const alvo = await prisma.clientes.findUnique({ where: { id: clienteId } })

    if (!alvo || alvo.empresa_id !== empresaId) {
        return { success: false, error: "Cliente não encontrado." }
    }

    try {
        // Loga antes de apagar, ja que depois nao teremos mais o nome a mao.
        await RegistrarAcao({
            tabela: 'Clientes',
            operacao: `Excluiu o cliente ${alvo.nome} (e todas as notas/pagamentos vinculados)`,
            empresa_id: empresaId,
            usuario_id: Number(Auth.usuario_id)
        })

        // clientes -> pedidos e clientes -> pagamentos sao onDelete: Cascade
        // no banco, entao isso apaga o historico financeiro desse cliente.
        await prisma.clientes.delete({ where: { id: clienteId } })

        return { success: true }

    } catch (error) {
        console.error("Erro ao excluir cliente:", error)
        return { success: false, error: "Erro ao excluir o cliente." }
    }
}
