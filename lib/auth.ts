'use server'

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from 'next/navigation'
import prisma from './prisma'

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

    const usuario = await prisma.usuarios.findUnique({
        where: { id: Number(payload!.usuario_id) },
        select: {
            id: true,
            empresa: { select: { status: true, data_expiracao: true } }
        }
    });

    const expirada = usuario?.empresa?.data_expiracao
        ? new Date(usuario.empresa.data_expiracao) < new Date()
        : false;

    if (!usuario || !usuario.empresa || usuario.empresa.status !== 'ativo' || expirada) {
        (await cookies()).delete('token');
        redirect('/login?msg=sessao-invalida');
    }

    return payload;
}