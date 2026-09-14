'use client'

import { useState } from 'react'
import Link from 'next/link'
import Swal from 'sweetalert2'
import { solicitarRecuperacaoSenha } from './actions'

export default function EsqueciSenhaPage() {
    const [enviando, setEnviando] = useState(false)
    const [enviado, setEnviado] = useState(false)

    async function handleSubmit(formData: FormData) {
        const email = formData.get('email') as string
        setEnviando(true)

        const result = await solicitarRecuperacaoSenha(email)

        setEnviando(false)

        if (!result.success) {
            Swal.fire('Opa...', 'Erro inesperado. Tente de novo.', 'error')
            return
        }

        setEnviado(true)
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

                <h1 className="text-2xl font-bold text-gray-800">Esqueci minha senha</h1>

                {enviado ? (
                    <p className="text-gray-700">
                        Se esse e-mail estiver cadastrado, você vai receber um link de recuperação em instantes. Confere sua caixa de entrada (e o spam).
                    </p>
                ) : (
                    <>
                        <p className="text-gray-600 text-sm">
                            Digite o e-mail da sua conta que a gente manda um link pra redefinir a senha.
                        </p>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">E-mail:</label>
                            <input
                                type="text"
                                name='email'
                                className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={enviando}
                            className="w-full rounded-md bg-blue-600 py-2 text-white cursor-pointer hover:bg-blue-800 duration-300 disabled:opacity-50"
                        >
                            {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
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
