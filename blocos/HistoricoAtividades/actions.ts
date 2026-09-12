'use server'

import prisma from "@/lib/prisma"
import autenticar from "@/lib/auth"

export async function pegarAtividades() {
    const Auth = await autenticar()

    if (!Auth) {
        return { success: false, error: "Sessão expirada ou inválida" }
    }

    if (Auth.role !== 'gestor') {
        return { success: false, error: "Apenas gestores podem ver o histórico de atividades." }
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
