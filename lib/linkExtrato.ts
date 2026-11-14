import { createHmac, timingSafeEqual } from 'node:crypto'
import prisma from './prisma'
import { colunaExiste } from './colunas'

// Link público do extrato (/extrato/<token>): o cliente da loja abre no celular, sem login.
// O token é "id.validade.assinatura": não precisa de tabela, e ninguém consegue trocar o id pra ver outro cliente
// porque a assinatura (HMAC com o segredo do servidor) deixa de bater. Vale 30 dias: link velho esquecido num
// grupo de WhatsApp para de funcionar sozinho. O QR do comprovante impresso vale mais (90), porque o papel fica guardado.
//
// Desativar os links de um cliente antes de vencer (ex.: mandou pro número errado): clientes.extrato_versao soma 1
// e entra na assinatura. Versão 0 assina exatamente como antes, então os links já mandados continuam valendo até
// alguém desativar. A coluna vem da migração 2026-11-14; sem ela, tudo segue na versão 0.
const VALIDADE_DIAS = 30
const DIA_MS = 86_400_000

function assinar(conteudo: string, versao: number) {
    const segredo = process.env.JWT_SECRET
    if (!segredo) throw new Error('JWT_SECRET ausente')
    const texto = versao > 0 ? `extrato:${conteudo}:v${versao}` : `extrato:${conteudo}`
    return createHmac('sha256', segredo).update(texto).digest('base64url').slice(0, 22)
}

export async function versaoDoExtrato(clienteId: number): Promise<number> {
    if (!(await colunaExiste('clientes', 'extrato_versao'))) return 0
    const r = await prisma.$queryRaw<{ v: number }[]>`SELECT extrato_versao AS v FROM clientes WHERE id = ${clienteId}`
    return Number(r[0]?.v ?? 0)
}

// Soma 1 na versão: todo link/QR já mandado pra esse cliente para de abrir. false = migração ainda não rodou.
export async function desativarLinksDoExtrato(clienteId: number): Promise<boolean> {
    if (!(await colunaExiste('clientes', 'extrato_versao'))) return false
    await prisma.$executeRaw`UPDATE clientes SET extrato_versao = extrato_versao + 1 WHERE id = ${clienteId}`
    return true
}

export async function criarTokenExtrato(clienteId: number, dias = VALIDADE_DIAS) {
    const validade = Math.floor(Date.now() / DIA_MS) + dias
    const conteudo = `${clienteId.toString(36)}.${validade.toString(36)}`
    return `${conteudo}.${assinar(conteudo, await versaoDoExtrato(clienteId))}`
}

// Devolve o id do cliente, ou null se o token for inválido, adulterado, vencido ou desativado.
export async function lerTokenExtrato(token: string): Promise<number | null> {
    const partes = token.split('.')
    if (partes.length !== 3) return null
    const [id36, validade36, assinatura] = partes

    const id = parseInt(id36, 36)
    if (!Number.isSafeInteger(id) || id <= 0) return null
    if (!(parseInt(validade36, 36) >= Math.floor(Date.now() / DIA_MS))) return null

    const esperada = Buffer.from(assinar(`${id36}.${validade36}`, await versaoDoExtrato(id)))
    const recebida = Buffer.from(assinatura)
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null
    return id
}
