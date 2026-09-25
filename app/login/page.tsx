'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { enviarLogin } from './actions';
import Swal from 'sweetalert2';
import { useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { IconeOlho, IconeOlhoFechado, IconeCheck } from '@/componentes/Icones';
import AssinaturaModal from '@/modais/assinatura/pages';

export default function LoginPage() {

    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [billingToken, setBillingToken] = useState<string | null>(null);
    const [erro, setErro] = useState('');
    const [verSenha, setVerSenha] = useState(false);

    async function handleSubmit(formData: FormData) {
        setErro('');
        const result = await enviarLogin(formData);

        if (!result.success && result.podeAssinar && result.billingToken) {
            setBillingToken(result.billingToken);
            return;
        }

        // erro inline, junto do formulário (antes era um popup que tirava o foco do campo)
        if (!result.success || !result.data) {
            setErro(result.error || 'Erro inesperado. Tente de novo.');
            return;
        }

        if (result.success) {

            localStorage.setItem('empresa', JSON.stringify(result.data.empresa));
            localStorage.setItem('usuario', JSON.stringify(result.data.usuario));
            localStorage.setItem('settings', JSON.stringify(result.data.settings));

            startTransition(() => {
                router.push('/dashboard');
                router.refresh();
            });
        }
    }

    useEffect(() => {
        const params = new URLSearchParams(location.search);

        if (params.get('msg') === 'sucesso') {
            Swal.fire({
                title: '🚀 Conta Criada!',
                text: 'Sua jornada na ZentraX começou. Faça login agora!',
                icon: 'success',
                confirmButtonColor: '#008CBA'
            });
        }

        if (params.get('msg') === 'sessao-invalida') {
            Swal.fire({
                title: 'Sessão encerrada',
                text: 'Sua sessão não é mais válida. Faça login novamente.',
                icon: 'warning',
                confirmButtonColor: '#008CBA'
            });
        }

    }, []);

    return (
        <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-slate-50">

            {/* Lado da marca: sem foto externa (antes vinha do Pexels), com o próprio produto */}
            <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-marca-950 to-marca-700 text-white p-12 relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                    <img src="/Logo.png" alt="" className="h-9" />
                    <span className="font-[TT_Milks] font-bold text-xl tracking-wide">ZentraX</span>
                </div>

                <div className="max-w-md">
                    <h2 className="text-4xl font-semibold tracking-tight leading-[1.1] mb-5">
                        Chega de caderninho.<br />
                        <span className="text-cyan-300">Saiba quem te deve e quanto.</span>
                    </h2>
                    <ul className="space-y-2.5 text-slate-200">
                        {['Clientes e notas num lugar só', 'Cobrança pelo WhatsApp com a mensagem pronta', 'Baixa total ou parcial dos pagamentos'].map(t => (
                            <li key={t} className="flex items-start gap-2.5">
                                <IconeCheck className="w-5 h-5 mt-0.5 text-cyan-300 shrink-0" />
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative -mb-24 -mr-24 rounded-2xl overflow-hidden ring-1 ring-white/15 shadow-2xl shadow-black/40">
                    <Image src="/preview-app-v2.png" alt="Tela do ZentraX com a lista de clientes e valores em aberto" width={1280} height={720} className="w-full h-auto" priority />
                </div>
            </aside>

            <main className="flex items-center justify-center px-5 py-10">
                <form action={handleSubmit} className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
                        <img src="/Logo.png" alt="" className="h-9" />
                        <span className="font-[TT_Milks] font-bold text-xl tracking-wide text-marca-950">ZentraX</span>
                    </div>

                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Entrar</h1>
                    <p className="text-sm text-slate-500 mt-1 mb-7">Acesse a sua conta para ver quem está devendo.</p>

                    {erro && (
                        <div role="alert" className="mb-5 rounded-lg bg-red-50 ring-1 ring-red-600/20 text-red-700 text-sm px-4 py-3">
                            {erro}
                        </div>
                    )}

                    <label htmlFor="usuario" className="block text-sm font-medium text-slate-700 mb-1.5">Usuário</label>
                    <input
                        id="usuario"
                        type="text"
                        name="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        className="w-full rounded-lg bg-white ring-1 ring-slate-900/10 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-marca-700 transition-shadow mb-4"
                    />

                    <label htmlFor="senha" className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
                    <div className="relative mb-2">
                        <input
                            id="senha"
                            type={verSenha ? 'text' : 'password'}
                            name="password"
                            autoComplete="current-password"
                            required
                            className="w-full rounded-lg bg-white ring-1 ring-slate-900/10 pl-3.5 pr-11 py-2.5 outline-none focus:ring-2 focus:ring-marca-700 transition-shadow"
                        />
                        <button
                            type="button"
                            onClick={() => setVerSenha(v => !v)}
                            aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                            {verSenha ? <IconeOlhoFechado /> : <IconeOlho />}
                        </button>
                    </div>

                    <Link href="/esqueci-senha" className="text-sm text-marca-700 hover:underline block text-right mb-6">
                        Esqueceu a senha?
                    </Link>

                    <BotaoEntrar />

                    <p className="text-sm text-slate-600 mt-7 text-center">
                        Ainda não tem conta?{' '}
                        <a href="https://zentrax.dvls.com.br/cadastro" className="text-marca-700 hover:underline font-medium whitespace-nowrap">
                            Teste 7 dias grátis
                        </a>
                    </p>
                </form>
            </main>

            {billingToken &&
                <AssinaturaModal
                    billingToken={billingToken}
                    sair={() => setBillingToken(null)}
                />}
        </div>
    );
}

// useFormStatus só funciona dentro do <form>: por isso o botão é um componente à parte.
// Desabilita e mostra "Entrando..." durante o envio (antes dava pra clicar 2x).
function BotaoEntrar() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-marca-700 hover:bg-marca-800 active:scale-[0.99] disabled:opacity-70 disabled:cursor-wait text-white font-medium py-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
        >
            {pending ? 'Entrando...' : 'Entrar'}
        </button>
    );
}