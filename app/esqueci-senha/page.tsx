'use client'

import { useState } from 'react'
import Link from 'next/link'
import Swal from 'sweetalert2'
import { useFormStatus } from 'react-dom'
import { solicitarRecuperacaoSenha } from './actions'
import PainelMarca from '@/componentes/PainelMarca'
import LogoMobile from '@/componentes/LogoMobile'

export default function EsqueciSenhaPage() {
    const [enviado, setEnviado] = useState(false)

    async function handleSubmit(formData: FormData) {
        const email = formData.get('email') as string
        const result = await solicitarRecuperacaoSenha(email)

        if (!result.success) {
            Swal.fire('Opa...', 'Erro inesperado. Tente de novo.', 'error')
            return
        }
        setEnviado(true)
    }

    return (
        <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-slate-50">
            <PainelMarca />

            <main className="flex items-center justify-center px-5 py-10 bg-white lg:border-l lg:border-slate-200">
                <div className="w-full max-w-sm">
                    <LogoMobile />

                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Esqueci minha senha</h1>

                    {enviado ? (
                        <>
                            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                                Se esse e-mail estiver cadastrado, você vai receber um link de recuperação em instantes. Confere sua caixa de entrada (e o spam).
                            </p>
                            <Link href="/login" className="text-sm text-marca-700 hover:underline block mt-7">
                                ← Voltar para o login
                            </Link>
                        </>
                    ) : (
                        <form action={handleSubmit}>
                            <p className="text-sm text-slate-500 mt-1 mb-7">Digite o e-mail da sua conta que a gente manda um link pra redefinir a senha.</p>

                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                autoCapitalize="none"
                                spellCheck={false}
                                required
                                className="w-full rounded-lg bg-white ring-1 ring-slate-900/10 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-marca-700 transition-shadow mb-6"
                            />

                            <BotaoEnviar />

                            <Link href="/login" className="text-sm text-marca-700 hover:underline block text-center mt-7">
                                ← Voltar para o login
                            </Link>
                        </form>
                    )}
                </div>
            </main>
        </div>
    )
}

function BotaoEnviar() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-marca-700 hover:bg-marca-800 active:scale-[0.99] disabled:opacity-70 disabled:cursor-wait text-white font-medium py-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
        >
            {pending ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
    )
}
