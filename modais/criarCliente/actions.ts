'use server'

import { jwtVerify } from "jose"
import { cookies } from "next/headers"
import prisma from "@/lib/prisma"
import RegistrarAcao from "@/lib/logger"

export default async function cadastrarClienteBack(formData: FormData) {
    const nome = String(formData.get('nome'))
    const whatsapp = Number(formData.get('whatsapp'))
    const documento = String(formData.get('documento'))
 
    if (!nome) {
        return {
            success: false,
            error: "Preencha todos os campos obrigatórios."
        }
    }
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value

        if (!token) return { success: false, error: "Não autenticado" };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        const empresaId = payload.empresa_id
        const userId = payload.user_id

        const condicoes: any[] = [{ nome: String(nome) }];

        if (documento && documento.trim() !== "") {
            condicoes.push({ documento: String(documento) });
        }

        const jaExiste = await prisma.clientes.findFirst({
            where: {
                empresa_id: Number(empresaId),
                OR: condicoes
            }
        })

        if (jaExiste) {
            return {
                success: false,
                error: 'Cliente ou n° de documento já cadastrado!!'
            }
        }


        const novoCliente = await prisma.clientes.create({
            data: {
                nome: nome,
                whatsapp: whatsapp ? BigInt(whatsapp) : null,
                documento: documento || null,
                empresa_id: Number(empresaId)
            }
        })
        // registrando

        const txt = `Criou o cliente ${nome}`;

        await RegistrarAcao({
            tabela: 'Clientes',
            operacao: txt,
            empresa_id: Number(empresaId),
            usuario_id: Number(userId)
        });

        return ({
            success: true,
            novoCliente
        })

    } catch (error: unknown) {

        return ({
            success: false,
            error
        })
    }
} 