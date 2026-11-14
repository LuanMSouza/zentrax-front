import bcrypt from 'bcrypt'
import prisma from './prisma'
import { estourou, anotarFalha, esquecer } from './rateLimit'

// Regras de senha num lugar só (cadastro público, criar/alterar usuário, perfil, redefinir pelo e-mail).
// Senha antiga com 6 ou 7 caracteres continua entrando: a regra vale pra senha NOVA ou alterada.
export const SENHA_MIN = 8
export const SENHA_MAX = 72 // o bcrypt ignora o que passa de 72 bytes

export function erroDaSenhaNova(senha: unknown): string | null {
    const s = String(senha ?? '')
    if (s.trim().length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`
    if (Buffer.byteLength(s) > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`
    return null
}

// Hash bcrypt de verdade ($2a/$2b/$2y). Não existe mais senha em texto puro aceita em lugar nenhum.
export function ehHashBcrypt(valor: string | null | undefined) {
    return !!valor && /^\$2[aby]\$\d{2}\$.{53}$/.test(valor)
}

// Confere a senha de quem está logado antes de algo sensível (trocar senha/login, excluir cliente, abrir telas de
// usuários). No máximo 5 erros a cada 15 min por usuário: sem isso, quem pegasse uma sessão aberta testava senhas
// à vontade por aqui.
const MAX_ERROS = 5
const JANELA_MS = 15 * 60_000
export type ResultadoSenha = 'ok' | 'errada' | 'limite'

export async function conferirSenhaDoUsuario(usuarioId: number, senha: unknown): Promise<ResultadoSenha> {
    const chave = `confirmar-senha:${usuarioId}`
    if (estourou(chave, MAX_ERROS, JANELA_MS)) return 'limite'
    const u = await prisma.usuarios.findUnique({ where: { id: usuarioId }, select: { senha: true } })
    const certa = typeof senha === 'string' && senha.length > 0 && ehHashBcrypt(u?.senha)
        && await bcrypt.compare(senha, u!.senha)
    if (!certa) {
        anotarFalha(chave)
        return 'errada'
    }
    esquecer(chave)
    return 'ok'
}

export const MENSAGEM_SENHA: Record<Exclude<ResultadoSenha, 'ok'>, string> = {
    errada: 'Senha incorreta.',
    limite: 'Muitas tentativas de senha. Espere alguns minutos e tente de novo.',
}
