'use server'

import prisma from "@/lib/prisma"
import { sign } from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { USUARIO_DEMO } from "@/lib/demo"

// Entrada da demonstração pública: emite a sessão da empresa de exemplo sem
// pedir senha (ver lib/demo.ts). Devolve o mesmo formato do enviarLogin, que o
// cliente grava no localStorage, com `empresa.demo = true` pra TopBar mostrar o
// aviso e esconder o "Assinar".
export async function entrarDemo() {
    const usuario = await prisma.usuarios.findFirst({
        where: { usuario: USUARIO_DEMO },
        include: { empresa: { include: { empresa_settings: true } } }
    })
    if (!usuario?.empresa) {
        return { success: false as const, error: 'A demonstração está indisponível agora. Tente de novo em alguns minutos.' }
    }

    // sessão curta: quem gostou cria a conta dele
    const token = sign(
        { usuario_id: usuario.id, empresa_id: usuario.empresa_id, role: usuario.role },
        process.env.JWT_SECRET!,
        { expiresIn: '2h' }
    )
    const cookieStore = await cookies()
    cookieStore.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 2
    })

    return {
        success: true as const,
        data: {
            empresa: { id: usuario.empresa.id, nome: usuario.empresa.nome, segmento: usuario.empresa.segmento, expiracao: null, assinante: true, demo: true },
            usuario: { id: usuario.id, nome: usuario.nome, usuario: usuario.usuario, role: usuario.role },
            settings: usuario.empresa.empresa_settings,
        }
    }
}
