// actions.ts
'use server'

import api from "@/app/api"
import axios from "axios"


export async function salvarNota(dados: any) {
    try {
        const response = await api.post('/notas', dados)


        console.log(response);


        return ({ success: true, nota: response.data.nota })
    } catch (error: any) {

        console.error("❌ ERRO NA ACTION:", error.response?.data || error.message);

        if (axios.isAxiosError(error)) {
            const mensagemServidor = error.response?.data?.erro || "Erro no servidor";
            return { success: false, error: mensagemServidor };
        }

        return { success: false, error: "Ocorreu um erro inesperado." };

    }
}