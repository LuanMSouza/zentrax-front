'use server'

import autenticar from "@/lib/auth"
import prisma from "@/lib/prisma"
import RegistrarAcao from "@/lib/logger"

export default async function cadastrarClienteBack(formData: FormData) {
    const nome = String(formData.get('nome') ?? '').trim()
    // Aceita o whatsapp com espacos/tracos (ex: "11 99887-7665", como o
    // placeholder sugere) filtrando so os digitos antes de converter.
    const whatsappDigitos = String(formData.get('whatsapp') ?? '').replace(/\D/g, '')
    const documento = String(formData.get('documento') ?? '').trim()
 
    if (!nome) {
        return {
            success: false,
            error: "Preencha todos os campos obrigatórios."
        }
    }
    // checagem central (também barra empresa vencida/inativa); fora do try pro redirect de sessão inválida funcionar
    const auth = await autenticar()
    if (!auth) return { success: false, error: "Não autenticado" };

    try {
        const empresaId = auth.empresa_id
        const userId = auth.usuario_id

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
                whatsapp: whatsappDigitos ? BigInt(whatsappDigitos) : null,
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
            novoCliente: {
                ...novoCliente,
                whatsapp: novoCliente.whatsapp ? String(novoCliente.whatsapp) : ""
            }
        })

    } catch (error: unknown) {
        console.error("Erro ao cadastrar cliente:", error)

        return ({
            success: false,
            error: "Erro ao cadastrar o cliente."
        })
    }
}