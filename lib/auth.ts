'use server'

import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export default async function autenticar() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value

        if (!token) return { success: false, error: "Não autenticado" };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return payload
        
    } catch (error) {
        return null
    }
}