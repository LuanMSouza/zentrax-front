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
            <div className="lg:grid flex justify-center lg:grid-cols-[3fr_1fr] gap-7 w-11/12 h-full items-center">

                <div className='bg-amber-600 h-11/12 rounded-3xl shadow-lg lg:block hidden shadow-gray-900 border-3 border-white overflow-hidden relative'>
                    <img
                        className='w-full h-full filter grayscale-100 z-0'
                        src="https://images.pexels.com/photos/164686/pexels-photo-164686.jpeg" alt="Foto caderno cheio" />

                    <p className='absolute font-[Playwrite] inset-0 m-auto flex -rotate-3
                    items-center justify-center z-10 overflow-hidden p-2 rounded-2xl text-4xl bg-black text-white w-fit h-fit text-center max-w-4/5'>
                        Quase lá!
                        <span className='font-[Bebas_Neue] text-5xl bg-emerald-600 p-2 m-1'>
                            Última etapa
                        </span>
                        pra voltar ao seu painel
                    </p>
                </div>

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
