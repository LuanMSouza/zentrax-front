'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Swal from 'sweetalert2'
import { useFormStatus } from 'react-dom'
import { redefinirSenha } from './actions'
import { IconeOlho, IconeOlhoFechado } from '@/componentes/Icones'
import PainelMarca from '@/componentes/PainelMarca'
import LogoMobile from '@/componentes/LogoMobile'

export default function RedefinirSenhaPage() {
    return (
        <Suspense>
            <RedefinirSenhaForm />
        </Suspense>
    )
}

function RedefinirSenhaForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get('token') ?? ''
    const [erro, setErro] = useState('')
    const [verSenha, setVerSenha] = useState(false)

    async function handleSubmit(formData: FormData) {
        setErro('')
        const novaSenha = formData.get('novaSenha') as string
        const confirmarSenha = formData.get('confirmarSenha') as string

        if (novaSenha !== confirmarSenha) {
            setErro('As senhas não coincidem.')
            return
        }

        const result = await redefinirSenha(token, novaSenha)
        if (!result.success) {
            setErro(result.error)
            return
        }

        await Swal.fire({ title: 'Sucesso!', text: 'Sua senha foi redefinida. Faça login com a nova senha.', icon: 'success', confirmButtonColor: '#004b6b' })
        router.push('/login')
    }

    return (
        <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-slate-50">
            <PainelMarca />

            <main className="flex items-center justify-center px-5 py-10 bg-white lg:border-l lg:border-slate-200">
                <div className="w-full max-w-sm">
                    <LogoMobile />

                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Redefinir senha</h1>

                    {!token ? (
                        <>
                            <p className="text-sm text-red-700 mt-3">Link inválido. Solicite a recuperação de senha de novo.</p>
                            <Link href="/esqueci-senha" className="text-sm text-marca-700 hover:underline block mt-7">
                                Solicitar novo link
                            </Link>
                        </>
                    ) : (
                        <form action={handleSubmit} className="mt-7">
                            {erro && (
                                <div role="alert" className="mb-5 rounded-lg bg-red-50 ring-1 ring-red-600/20 text-red-700 text-sm px-4 py-3">
                                    {erro}
                                </div>
                            )}

                            <label htmlFor="novaSenha" className="block text-sm font-medium text-slate-700 mb-1.5">Nova senha</label>
                            <div className="relative mb-4">
                                <input
                                    id="novaSenha"
                                    type={verSenha ? 'text' : 'password'}
                                    name="novaSenha"
                                    autoComplete="new-password"
                                    required
                                    minLength={6}
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

                            <label htmlFor="confirmarSenha" className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar nova senha</label>
                            <input
                                id="confirmarSenha"
                                type={verSenha ? 'text' : 'password'}
                                name="confirmarSenha"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                className="w-full rounded-lg bg-white ring-1 ring-slate-900/10 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-marca-700 transition-shadow mb-6"
                            />

                            <BotaoRedefinir />
                        </form>
                    )}
                </div>
            </main>
        </div>
    )
}

function BotaoRedefinir() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-marca-700 hover:bg-marca-800 active:scale-[0.99] disabled:opacity-70 disabled:cursor-wait text-white font-medium py-2.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
        >
            {pending ? 'Salvando...' : 'Redefinir senha'}
        </button>
    )
}
