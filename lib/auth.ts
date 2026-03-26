'use server'

import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from 'next/navigation'

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

    return payload;
}