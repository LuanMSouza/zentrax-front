import { createHmac, timingSafeEqual } from 'node:crypto'

// Link público do extrato (/extrato/<token>): o cliente da loja abre no celular, sem login.
// O token é "id.validade.assinatura": não precisa de tabela, e ninguém consegue trocar o id pra ver outro cliente
// porque a assinatura (HMAC com o segredo do servidor) deixa de bater. Vale 30 dias: link velho esquecido num
// grupo de WhatsApp para de funcionar sozinho. O QR do comprovante impresso vale mais (90), porque o papel fica guardado.
const VALIDADE_DIAS = 30
const DIA_MS = 86_400_000

function assinar(conteudo: string) {
    const segredo = process.env.JWT_SECRET
    if (!segredo) throw new Error('JWT_SECRET ausente')
    return createHmac('sha256', segredo).update(`extrato:${conteudo}`).digest('base64url').slice(0, 22)
}

export function criarTokenExtrato(clienteId: number, dias = VALIDADE_DIAS) {
    const validade = Math.floor(Date.now() / DIA_MS) + dias
    const conteudo = `${clienteId.toString(36)}.${validade.toString(36)}`
    return `${conteudo}.${assinar(conteudo)}`
}

// Devolve o id do cliente, ou null se o token for inválido, adulterado ou vencido.
export function lerTokenExtrato(token: string): number | null {
    const partes = token.split('.')
    if (partes.length !== 3) return null
    const [id36, validade36, assinatura] = partes

    const esperada = Buffer.from(assinar(`${id36}.${validade36}`))
    const recebida = Buffer.from(assinatura)
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null

    if (parseInt(validade36, 36) < Math.floor(Date.now() / DIA_MS)) return null
    const id = parseInt(id36, 36)
    return Number.isSafeInteger(id) && id > 0 ? id : null
}
