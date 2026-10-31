import prisma from './prisma'
import { Permissao, MapaPermissoes, permissoesDe } from './permissoes'

// Confere no servidor se quem está logado pode fazer algo (gestor sempre; atendente se o gestor liberou).
// Toda action que antes era "só gestor" e virou liberável passa por aqui: esconder o botão não basta.
export async function permissoesDoUsuario(Auth: Record<string, unknown>): Promise<MapaPermissoes> {
    if (Auth.role === 'gestor') return permissoesDe('gestor', null)
    const s = await prisma.empresa_settings.findFirst({
        where: { empresa_id: Number(Auth.empresa_id) },
        select: { permissoes_atendente: true }
    })
    return permissoesDe(Auth.role, s?.permissoes_atendente)
}

export async function pode(Auth: Record<string, unknown>, p: Permissao) {
    return (await permissoesDoUsuario(Auth))[p]
}
