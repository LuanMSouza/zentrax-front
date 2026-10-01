'use server'

import autenticar from '@/lib/auth'
import { resumoIndicacao } from '@/lib/indicacao'
import { ehEmpresaDemo, BLOQUEADO_NA_DEMO } from '@/lib/demo'

export async function obterIndicacao() {
    const payload = await autenticar()
    if (await ehEmpresaDemo(payload?.empresa_id)) return BLOQUEADO_NA_DEMO
    try {
        const r = await resumoIndicacao(Number(payload!.empresa_id))
        return { success: true as const, data: r }
    } catch (error) {
        console.error('Erro ao obter indicação:', error)
        return { success: false as const, error: 'Não foi possível carregar seu link de indicação.' }
    }
}
