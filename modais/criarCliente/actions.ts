'use server'

import api from "@/app/api"
import axios from "axios"

export default async function cadastrarClienteBack(formData: FormData) {
    const nome = formData.get('nome')
    const whatsapp = formData.get('whatsapp')
    const documento = formData.get('documento')

    try {
        const response = await api.post('/clientes', { nome, whatsapp, documento })

        return ({ success: true, data: response.data.cliente })
    } catch (error: unknown) {
        console.error("Erro completo:", error);

        if (axios.isAxiosError(error)) {
            const mensagemServidor = error.response?.data?.erro || "Erro no servidor";
            return { success: false, error: mensagemServidor };
        }

        return { success: false, error: "Ocorreu um erro inesperado." };
    }
}