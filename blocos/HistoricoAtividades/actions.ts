'use server'

import prisma from "@/lib/prisma"
import autenticar from "@/lib/auth"
import { pode } from "@/lib/permissoesServidor"

export async function pegarAtividades() {
    const Auth = await autenticar()

    if (!Auth) {
        return { success: false, error: "Sessão expirada ou inválida" }
    }

    if (!(await pode(Auth, 'historico'))) {
        return { success: false, error: "Você não tem permissão pra ver o histórico." }
    }

    try {
        const atividades = await prisma.alteracoes.findMany({
            where: { empresa: Number(Auth.empresa_id) },
            orderBy: { data: 'desc' },
            take: 50,
            include: {
                usuarios: { select: { nome: true } }
            }
        })

        return {
            success: true,
            atividades: atividades.map(a => ({
                id: a.id,
                operacao: a.operacao,
                data: a.data,
                usuario: a.usuarios?.nome ?? 'Sistema'
            }))
        }
    } catch (error) {
        console.error("Erro ao buscar atividades:", error)
        return { success: false, error: "Erro ao buscar o histórico de atividades." }
    }
}
