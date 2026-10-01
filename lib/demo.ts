import prisma from './prisma'

// Demonstração pública (botão "Ver demonstração" da LP → /demo). Qualquer pessoa
// entra sem senha numa empresa de dados fictícios, que volta ao estado original
// de hora em hora (/var/www/_ops/zentrax-demo-publica.sql, cron do luan).
// Mexer em clientes/notas/pagamentos é liberado (é pra isso que serve); conta,
// usuários, preferências e assinatura ficam travados (BLOQUEADO_NA_DEMO).
export const USUARIO_DEMO = 'demo.publico'
export const BLOQUEADO_NA_DEMO = {
    success: false as const,
    error: 'Na demonstração isso fica desligado. Crie sua conta grátis para usar de verdade.',
}

let empresaDemo: { id: number | null; em: number } | null = null

async function idEmpresaDemo(): Promise<number | null> {
    if (empresaDemo && Date.now() - empresaDemo.em < 5 * 60_000) return empresaDemo.id
    const u = await prisma.usuarios.findFirst({ where: { usuario: USUARIO_DEMO }, select: { empresa_id: true } })
    empresaDemo = { id: u?.empresa_id ?? null, em: Date.now() }
    return empresaDemo.id
}

export async function ehEmpresaDemo(empresaId: unknown): Promise<boolean> {
    const id = await idEmpresaDemo()
    return id !== null && Number(empresaId) === id
}
