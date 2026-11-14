import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Token de SESSÃO tem usuario_id. O billingToken (checkout de loja vencida) é assinado com o mesmo segredo mas tem
// "purpose": se valesse aqui, abria a casca do /dashboard pra quem só podia pagar.
async function sessaoValida(token: string, secret: Uint8Array) {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose || !payload.usuario_id) throw new Error('token sem sessão');
}

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const { pathname } = request.nextUrl;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    // /extrato/%E0%A4%A (porcentagem quebrada): o Next tentava decodificar e respondia erro 500. Link torto vira
    // "link expirado" como qualquer token inválido.
    if (pathname.startsWith('/extrato/')) {
        try {
            decodeURIComponent(pathname)
            return NextResponse.next();
        } catch {
            return NextResponse.redirect(new URL('/extrato/invalido', request.url));
        }
    }

    if (pathname === '/') {
        if (token) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }


    if (pathname === '/login') {
        if (!token) return NextResponse.next();

        try {
            await sessaoValida(token, secret);
            return NextResponse.redirect(new URL('/dashboard', request.url));
        } catch {
            return NextResponse.next(); // Token inválido no login? Deixa o usuário logar de novo
        }
    }

    if (pathname.startsWith('/dashboard')) {
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            await sessaoValida(token, secret);
            return NextResponse.next();
        } catch {
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete('token');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/login', '/', '/extrato/:path*'],
};