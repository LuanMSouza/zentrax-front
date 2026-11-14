import { sign } from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { Prisma } from '@prisma/client'
import prisma from './prisma'
import { colunaExiste } from './colunas'

// Sessão = cookie "token" (JWT assinado). O JWT sozinho não dá pra "desligar" antes de vencer (24h), então cada
// usuário tem um número de versão no banco (usuarios.sessao_versao) que vai junto no token ("sv"):
//   - login grava a versão atual no token;
//   - sair, trocar/redefinir a senha e mudar o papel (gestor <-> atendente) somam 1 no banco;
//   - autenticar() compara: token com versão velha = sessão encerrada, na hora.
// Além disso, papel e loja passam a vir do BANCO (não do token): gestor rebaixado vira atendente no próximo clique.
//
// Plano B: a coluna sessao_versao vem da migração prisma/manual/2026-11-14-seguranca-qa.sql. Se o código subir
// antes dela, tudo funciona igual a antes (versão 0 pra todo mundo, logout só apaga o cookie) e, assim que a
// migração rodar, passa a valer sozinho (lib/colunas.ts confere de novo a cada minuto). Por isso a coluna fica fora do
// schema.prisma por enquanto: se estivesse lá, toda consulta em usuarios quebraria antes da migração (P2022).

type DadosSessao = {
    role: string | null
    empresaId: number | null
    versao: number
    status: string | null
    dataExpiracao: Date | null
    expiraEm: number
}

// Cache curto: autenticar() roda em todo clique. O que muda o acesso de alguém (sair, senha, papel, remover)
// chama esquecerSessao() no mesmo processo (o app roda num processo só no PM2), então o cache nunca segura
// uma sessão encerrada; os 30 s só atrasam o bloqueio/ativação da loja (status), como já era.
const CACHE_TTL_MS = 30_000
const cache = new Map<number, DadosSessao>()

const colunaVersaoExiste = () => colunaExiste('usuarios', 'sessao_versao')

export async function dadosDaSessao(usuarioId: number): Promise<DadosSessao | null> {
    const emCache = cache.get(usuarioId)
    if (emCache && emCache.expiraEm > Date.now()) return emCache

    const versao = (await colunaVersaoExiste()) ? Prisma.sql`u.sessao_versao` : Prisma.sql`0`
    const linhas = await prisma.$queryRaw<{ role: string | null, empresa_id: number | null, versao: number, status: string | null, data_expiracao: Date | null }[]>`
        SELECT u.role, u.empresa_id, ${versao}::int AS versao, e.status, e.data_expiracao
        FROM usuarios u LEFT JOIN empresa e ON e.id = u.empresa_id
        WHERE u.id = ${usuarioId}`
    const u = linhas[0]
    if (!u) {
        cache.delete(usuarioId)
        return null
    }
    const dados: DadosSessao = {
        role: u.role,
        empresaId: u.empresa_id,
        versao: Number(u.versao ?? 0),
        status: u.status,
        dataExpiracao: u.data_expiracao,
        expiraEm: Date.now() + CACHE_TTL_MS,
    }
    cache.set(usuarioId, dados)
    return dados
}

export function esquecerSessao(usuarioId: number) {
    cache.delete(usuarioId)
}

// Derruba todas as sessões abertas do usuário (em qualquer aparelho). Devolve a versão nova.
export async function encerrarSessoes(usuarioId: number): Promise<number> {
    esquecerSessao(usuarioId)
    if (!(await colunaVersaoExiste())) return 0
    const r = await prisma.$queryRaw<{ sessao_versao: number }[]>`
        UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE id = ${usuarioId} RETURNING sessao_versao`
    esquecerSessao(usuarioId)
    return Number(r[0]?.sessao_versao ?? 0)
}

// Emite o cookie de sessão (login, demo e depois de trocar a própria senha, pra quem trocou continuar logado).
export async function abrirSessao(usuario: { id: number, empresa_id: number | null, role: string | null }, horas = 24) {
    const dados = await dadosDaSessao(usuario.id)
    const token = sign(
        // role/empresa_id seguem no token só pra compatibilidade; quem decide é o banco (autenticar())
        { usuario_id: usuario.id, empresa_id: usuario.empresa_id, role: usuario.role, sv: dados?.versao ?? 0 },
        process.env.JWT_SECRET!,
        { expiresIn: `${horas}h` }
    )
    const cookieStore = await cookies()
    cookieStore.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * horas
    })
}
