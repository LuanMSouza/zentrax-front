'use server'

import api from "../api";
import axios from "axios";

export async function enviarLogin(formData: FormData) {

    const email = formData.get('email');
    const password = formData.get('password');

    const loginData = { email, senha: password };

    try {
        const response = await api.post('/login', { loginData })
        return { success: true, data: response.data };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            return { success: false, error: error.response?.data?.erro || "Erro desconhecido" };
        } else {
            return { success: false, error: "Erro interno no servidor" };
        }
    }

}