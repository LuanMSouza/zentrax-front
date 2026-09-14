'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Swal from 'sweetalert2'
import { redefinirSenha } from './actions'

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
    const [enviando, setEnviando] = useState(false)

    async function handleSubmit(formData: FormData) {
        const novaSenha = formData.get('novaSenha') as string
        const confirmarSenha = formData.get('confirmarSenha') as string

        if (novaSenha !== confirmarSenha) {
            Swal.fire('Opa...', 'As senhas não coincidem.', 'error')
            return
        }

        setEnviando(true)
        const result = await redefinirSenha(token, novaSenha)
        setEnviando(false)

        if (!result.success) {
            Swal.fire('Opa...', result.error, 'error')
            return
        }

        await Swal.fire('Sucesso!', 'Sua senha foi redefinida. Faça login com a nova senha.', 'success')
        router.push('/login')
    }

    return (
        <div className='w-screen flex items-center justify-center h-screen'>
            <form
                action={handleSubmit}
                className="w-full max-w-md space-y-4 rounded-lg bg-white p-8 shadow-md"
            >
                <div className='flex items-center gap-1 w-full justify-center'>
                    <img className='w-1/7' src="/Logo.png" alt="Logo ZentraX" />
                    <p className='text-2xl font-["TT_Milks"] font-bold'>ZentraX</p>
                </div>

                <h1 className="text-2xl font-bold text-gray-800">Redefinir senha</h1>

                {!token ? (
                    <p className="text-red-600">Link inválido. Solicite a recuperação de senha de novo.</p>
                ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nova senha:</label>
                            <input
                                type="password"
                                name='novaSenha'
                                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                                required
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirmar nova senha:</label>
                            <input
                                type="password"
                                name='confirmarSenha'
                                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={enviando}
                            className="w-full rounded-md bg-blue-600 py-2 text-white cursor-pointer hover:bg-blue-800 duration-300 disabled:opacity-50"
                        >
                            {enviando ? 'Salvando...' : 'Redefinir senha'}
                        </button>
                    </>
                )}

                <div className='h-0.5 bg-gray-50'></div>
                <Link href="/login" className="text-blue-600 hover:underline text-sm block text-center">
                    Voltar pro login
                </Link>
            </form>
        </div>
    )
}
