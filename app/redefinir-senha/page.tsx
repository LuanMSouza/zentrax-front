'use client';

import Swal from 'sweetalert2';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { redefinirSenha } from './actions';

function RedefinirSenhaForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [enviando, setEnviando] = useState(false);

    async function handleSubmit(formData: FormData) {
        setEnviando(true);
        try {
            const result = await redefinirSenha(formData);

            if (!result.success) {
                Swal.fire('Opa...', result.error, 'error');
                return;
            }

            await Swal.fire('Prontinho!', 'Sua senha foi redefinida com sucesso.', 'success');
            router.push('/login?msg=senha-redefinida');
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className='w-screen flex items-center justify-center h-screen overflow-hidden'>
            <form
                action={handleSubmit}
                className="w-full max-w-md space-y-4 rounded-lg bg-white p-8 shadow-md h-fit"
            >
                <div className='flex items-center gap-1 w-full justify-center'>
                    <img className='w-1/7' src="/Logo.png" alt="Logo ZentraX" />
                    <p className='text-2xl font-["TT_Milks"] font-bold'>ZentraX</p>
                </div>

                <h1 className="text-2xl font-bold text-gray-800">Criar nova senha</h1>

                <input type="hidden" name="token" value={token} />

                {!token && (
                    <p className="text-sm text-red-600">Link inválido ou incompleto. Solicite um novo em "Esqueci minha senha".</p>
                )}

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
                    disabled={enviando || !token}
                    className="w-full rounded-md bg-blue-600 py-2 text-white cursor-pointer
                     hover:bg-blue-800 duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {enviando ? 'Salvando...' : 'Redefinir senha'}
                </button>
            </form>
        </div>
    );
}

export default function RedefinirSenhaPage() {
    return (
        <Suspense>
            <RedefinirSenhaForm />
        </Suspense>
    );
}
