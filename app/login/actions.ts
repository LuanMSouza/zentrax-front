'use server'

import prisma from "@/lib/prisma"; // Use aquele Singleton que criamos
import bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken'; // Substitui o fastify.jwt
import { cookies } from 'next/headers'

export async function enviarLogin(formData: FormData) {
    const email = formData.get('email') as string;
    const senha = formData.get('password') as string;

    try {
        const usuario = await prisma.usuarios.findFirst({
            where: {
                usuario: {
                    equals: email.toLowerCase().trim(),
                    mode: 'insensitive'
                }
            },
            include: {
                empresa: {
                    include: { empresa_settings: true }
                }
            }
        });

        if (!usuario || !usuario.empresa) {
            return { success: false, error: "Usuário sem empresa vinculada." };
        }


        let senhaValida = false;
        const hashRegex = /^\$2[aby]\$.{56}$/;

        if (hashRegex.test(usuario.senha)) {
            senhaValida = await bcrypt.compare(senha, usuario.senha);
        } else {
            senhaValida = senha === usuario.senha;
        }

        if (!senhaValida) {
            return { success: false, error: 'Usuário ou senha inválidos' };
        }

        const token = sign({
            usuario_id: usuario.id,
            empresa_id: usuario.empresa_id,
            role: usuario.role
        }, process.env.JWT_SECRET!, { expiresIn: '1d' });

        const cookieStore = await cookies();
        cookieStore.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24
        });

        return {
            success: true,
            data: {
                token,
                empresa: {
                    id: usuario?.empresa.id,
                    nome: usuario?.empresa.nome,
                    segmento: usuario?.empresa.segmento
                },
                usuario: {
                    id: usuario?.id,
                    nome: usuario?.nome,
                    usuario: usuario?.usuario,
                    role: usuario?.role,
                },
                settings: usuario?.empresa.empresa_settings
            }
        };

    } catch (error) {
        console.error("Erro no login:", error);
        return { success: false, error: 'Erro interno no servidor' };
    }
}