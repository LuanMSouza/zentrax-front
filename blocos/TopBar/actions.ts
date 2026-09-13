'use server'
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { PLANOS, PlanoId } from '@/lib/planos';

export async function logout() {
    (await cookies()).delete('token');
}

// Cria a sessao de checkout do Stripe pro plano escolhido. Enquanto
// STRIPE_SECRET_KEY nao estiver no .env, retorna error: 'not_configured'
// pra quem chamar cair no fallback de "fale com o suporte" (ja existente).
export async function criarSessaoRenovacao(planoId: PlanoId) {
    const stripe = getStripe();

    if (!stripe) {
        return { success: false, error: 'not_configured' as const };
    }

    const plano = PLANOS[planoId];
    if (!plano) {
        return { success: false, error: 'Plano inválido' };
    }

    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return { success: false, error: 'Sessão inválida' };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        const empresaId = Number(payload.empresa_id);

        const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
        if (!empresa) return { success: false, error: 'Empresa não encontrada' };

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.zentrax.dvls.com.br';

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'brl',
                    unit_amount: plano.valorCentavos,
                    product_data: { name: `ZentraX - Plano ${plano.nome} (${empresa.nome})` },
                },
                quantity: 1,
            }],
            metadata: {
                empresa_id: String(empresaId),
                plano_id: planoId,
                dias: String(plano.dias),
            },
            success_url: `${baseUrl}/dashboard?renovacao=sucesso`,
            cancel_url: `${baseUrl}/dashboard?renovacao=cancelada`,
        });

        return { success: true, url: session.url };
    } catch (error) {
        console.error('Erro ao criar sessão de renovação Stripe:', error);
        return { success: false, error: 'Erro ao iniciar pagamento' };
    }
}