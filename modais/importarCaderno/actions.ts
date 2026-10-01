'use server'

import autenticar from "@/lib/auth"
import prisma from "@/lib/prisma"
import RegistrarAcao from "@/lib/logger"
import { FormatarValor, hojeBR } from "@/lib/mask"
import { lerLista, LIMITE_LINHAS } from "@/lib/importarCaderno"
import { revalidatePath } from "next/cache"

// Grava a lista do "Importar do caderno" (ver lib/importarCaderno.ts).
// Cliente que já existe (mesmo nome, sem diferenciar maiúscula) não é duplicado:
// só ganha a nota de saldo. Tudo numa transação: ou entra a lista inteira, ou nada.
export async function importarCadernoBack(texto: string) {
    const auth = await autenticar()
    if (!auth) return { success: false as const, error: 'Sessão expirada ou inválida' }

    const linhas = lerLista(texto)
    const validas = linhas.filter(l => !l.erro)
    if (!validas.length) return { success: false as const, error: 'Nenhuma linha válida pra importar.' }
    if (linhas.length > LIMITE_LINHAS) {
        return { success: false as const, error: `No máximo ${LIMITE_LINHAS} linhas por vez. Divida a lista em partes.` }
    }

    const empresaId = Number(auth.empresa_id)
    try {
        const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { segmento: true } })
        const existentes = await prisma.clientes.findMany({ where: { empresa_id: empresaId }, select: { id: true, nome: true } })
        const porNome = new Map(existentes.map(c => [c.nome.trim().toLowerCase(), c.id]))
        const hoje = hojeBR()

        let novos = 0, notas = 0, total = 0
        await prisma.$transaction(async tx => {
            for (const l of validas) {
                const chave = l.nome.toLowerCase()
                let idCliente = porNome.get(chave)
                if (!idCliente) {
                    const c = await tx.clientes.create({ data: { nome: l.nome, empresa_id: empresaId } })
                    idCliente = c.id
                    porNome.set(chave, c.id)
                    novos++
                }
                if (l.valor && l.valor > 0) {
                    await tx.pedidos.create({
                        data: {
                            id_cliente: idCliente, data: hoje, empresa_id: empresaId,
                            valor_unitario: l.valor, valor_inicial: l.valor, valor_restante: l.valor,
                            descricao: 'Saldo anterior (caderno)', quantidade: 1, valor_extra: 0,
                            segmento: empresa?.segmento ?? 'geral',
                        }
                    })
                    notas++
                    total += l.valor
                }
            }
        }, { timeout: 30_000 })

        await RegistrarAcao({
            tabela: 'Clientes',
            operacao: `Importou do caderno: ${novos} clientes novos e ${notas} saldos (${FormatarValor(total)})`,
            empresa_id: empresaId,
            usuario_id: Number(auth.usuario_id),
        })
        revalidatePath('/dashboard')

        return { success: true as const, data: { novos, notas, total, ignoradas: linhas.length - validas.length } }
    } catch (error) {
        console.error('Erro ao importar do caderno:', error)
        return { success: false as const, error: 'Não foi possível importar a lista. Nada foi gravado.' }
    }
}
