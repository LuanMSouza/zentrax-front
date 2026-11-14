'use server'
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { encerrarSessoes } from '@/lib/sessao';
import { ehEmpresaDemo } from '@/lib/demo';

// Sair: além de apagar o cookie, encerra a sessão no servidor (soma 1 na versão), então quem copiou o token não
// consegue mais usar. Isso derruba as sessões desse usuário em TODOS os aparelhos (é o preço de não ter tabela de
// sessões). Na demo pública não: todo visitante usa o mesmo usuário e um sair derrubaria os outros.
export async function logout() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (token) {
        try {
            const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
            if (payload.usuario_id && !payload.purpose && !(await ehEmpresaDemo(payload.empresa_id))) {
                await encerrarSessoes(Number(payload.usuario_id));
            }
        } catch {
            // token inválido/vencido: só apaga o cookie
        }
    }
    cookieStore.delete('token');
}
