'use server'

import autenticar from '@/lib/auth'
import { resumoIndicacao } from '@/lib/indicacao'

export async function obterIndicacao() {
    const payload = await autenticar()
    try {
        const r = await resumoIndicacao(Number(payload!.empresa_id))
        return { success: true as const, data: r }
    } catch (error) {
        console.error('Erro ao obter indicação:', error)
        return { success: false as const, error: 'Não foi possível carregar seu link de indicação.' }
    }
}
