import prisma from './prisma'

// "Essa coluna já existe no banco?" Serve pro código novo funcionar antes E depois da migração manual
// (prisma/manual/*.sql): enquanto a coluna não existe, quem chama usa um plano B. Quando existe, fica guardado;
// quando não existe, confere de novo a cada minuto (a migração pode rodar com o app no ar, sem reiniciar).
const conhecidas = new Map<string, { existe: boolean, em: number }>()

export async function colunaExiste(tabela: string, coluna: string): Promise<boolean> {
    const chave = `${tabela}.${coluna}`
    const c = conhecidas.get(chave)
    if (c?.existe) return true
    if (c && Date.now() - c.em < 60_000) return false
    const r = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = ${tabela} AND column_name = ${coluna}`
    const existe = (r[0]?.n ?? 0) > 0
    conhecidas.set(chave, { existe, em: Date.now() })
    return existe
}
