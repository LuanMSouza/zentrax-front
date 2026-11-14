'use server'

import { jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from 'next/navigation'
import { dadosDaSessao } from './sessao'

// Toda action/rota autenticada passa por aqui. Confere, nesta ordem:
//   1. o token (assinatura e validade);
//   2. que é token de SESSÃO (o billingToken do checkout tem "purpose" e não tem usuario_id: só serve pra assinar);
//   3. que o usuário ainda existe e que a versão da sessão bate com a do banco (sair/trocar senha/mudar papel
//      derrubam as sessões antigas, ver lib/sessao.ts);
//   4. que a loja está ativa e não venceu.
// Devolve o payload com role e empresa_id lidos do BANCO: quem foi rebaixado perde o acesso de gestor na hora.
export default async function autenticar() {
    let payload: JWTPayload | null = null;

    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value

        if (token) {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET);
            payload = (await jwtVerify(token, secret)).payload;
        }
    } catch {
        payload = null;
    }

    if (!payload || payload.purpose || !payload.usuario_id) {
        redirect('/login');
    }

    const sessao = await dadosDaSessao(Number(payload.usuario_id));

    if (!sessao || Number(payload.sv ?? 0) !== sessao.versao) {
        (await cookies()).delete('token');
        redirect('/login?msg=sessao-invalida');
    }

    const expirada = sessao.dataExpiracao
        ? new Date(sessao.dataExpiracao) < new Date()
        : false;

    if (sessao.status !== 'ativo' || expirada) {
        (await cookies()).delete('token');
        redirect('/login?msg=sessao-invalida');
    }

    const usuarioLogado: JWTPayload & { usuario_id: number, role: string | null, empresa_id: number | null } =
        { ...payload, usuario_id: Number(payload.usuario_id), role: sessao.role, empresa_id: sessao.empresaId };
    return usuarioLogado;
}
