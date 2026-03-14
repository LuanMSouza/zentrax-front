'use server'
import { cookies } from 'next/headers';
import api from "../api"
import axios from "axios"

export async function pegarClientesBack() {

    try {
        const response = await api.get('/clientes')

        return { success: true, data: response.data }

    } catch (error) {
        console.error("Erro ao busar clientes:", error)

        let mensagem = "Erro desconhecido"

        if (axios.isAxiosError(error)) {
            mensagem = error.response?.data?.message || "Erro ao buscar clientes no servidor"
        }

        return { success: false, error: mensagem }
    }
}

export async function pegarNotasBack() {

    try {
        const response = await api.get('/notas')

        return { success: true, data: response.data }
    } catch (error) {
        console.error("Erro ao busar clientes:", error)

        let mensagem = "Erro desconhecido"

        if (axios.isAxiosError(error)) {
            mensagem = error.response?.data?.message || "Erro ao buscar clientes no servidor"
        }

        return { success: false, error: mensagem }

    }
}