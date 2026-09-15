'use server'

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from 'next/navigation'
import prisma from './prisma'

// autenticar() roda em toda action autenticada - sem cache isso vira 1
// query no banco por clique de cada usuario so pra checar se a assinatura
// segue ativa. Cache curto (30s) tira a maior parte dessa carga; pior caso
// e uma empresa bloqueada/ativada demorar ate 30s pra refletir no acesso.
type StatusEmpresa = { status: string | null; data_expiracao: Date | null; expiraEm: number }
const CACHE_TTL_MS = 30_000
const cacheStatusEmpresa = new Map<number, StatusEmpresa>()

async function statusEmpresaDoUsuario(usuarioId: number): Promise<StatusEmpresa> {
    const emCache = cacheStatusEmpresa.get(usuarioId)
    if (emCache && emCache.expiraEm > Date.now()) {
        return emCache
    }

    const usuario = await prisma.usuarios.findUnique({
        where: { id: usuarioId },
        select: { empresa: { select: { status: true, data_expiracao: true } } }
    })

    const entrada: StatusEmpresa = {
        status: usuario?.empresa?.status ?? null,
        data_expiracao: usuario?.empresa?.data_expiracao ?? null,
        expiraEm: Date.now() + CACHE_TTL_MS
    }
    cacheStatusEmpresa.set(usuarioId, entrada)
    return entrada
}

export default async function autenticar() {
    let authenticated = false;
    let payload = null;

    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value

        if (token) {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET);
            const verified = await jwtVerify(token, secret);
            payload = verified.payload;
            authenticated = true;
        }
    } catch (error) {
        authenticated = false;
    }

    if (!authenticated) {
        redirect('/login');
    }

    const info = await statusEmpresaDoUsuario(Number(payload!.usuario_id));

    const expirada = info.data_expiracao
        ? new Date(info.data_expiracao) < new Date()
        : false;

    if (info.status !== 'ativo' || expirada) {
        (await cookies()).delete('token');
        redirect('/login?msg=sessao-invalida');
    }

    return payload;
}