'use client';

import { useRouter } from 'next/navigation';
import { enviarLogin } from './actions';
import Swal from 'sweetalert2';
import { useEffect, useTransition } from 'react';

export default function LoginPage() {

    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    async function handleSubmit(formData: FormData) {
        const result = await enviarLogin(formData);

        if (!result.success || !result.data) {
            Swal.fire('Opa...', result.error || "Erro inesperado", 'error');
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
        } else {
            Swal.fire('Opa...', result.error, 'error');
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

    }, []);

    return (
        <div className='w-screen flex items-center justify-center h-screen overflow-hidden '>
            <div className="lg:grid flex justify-center lg:grid-cols-[3fr_1fr] gap-7 w-11/12 h-full items-center">

                <div className='bg-amber-600 h-11/12 rounded-3xl shadow-lg lg:block hidden shadow-gray-900 border-3 border-white overflow-hidden relative'>
                    <img
                        className='w-full h-full filter grayscale-100 z-0'
                        src="https://images.pexels.com/photos/164686/pexels-photo-164686.jpeg" alt="Foto caderno cheio" />

                    {/* texto */}

                    <p className='absolute font-[Playwrite] inset-0 m-auto flex -rotate-6
                    items-center justify-center z-10 overflow-hidden p-2 rounded-2xl text-5xl bg-black text-white w-fit h-fit'>
                        Diga
                        <span className='font-[Bebas_Neue] text-6xl bg-red-600 p-2 m-1 '>
                            ADEUS
                        </span>
                        para as contas em papel!
                    </p>

                </div>

                <form
                    action={handleSubmit}
                    className="w-full max-w-md space-y-4 rounded-lg bg-white p-8 shadow-md h-fit"
                >

                    <div className='flex items-center gap-1 w-full justify-center'>
                        <img
                            className='w-1/7'
                            src="/Logo.png" alt="Logo ZentraX" />
                        <p className='text-2xl font-["TT_Milks"] font-bold'>ZentraX</p>
                    </div>


                    <h1 className="text-2xl font-bold text-gray-800">Entrar</h1>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Usuario:</label>
                        <input
                            type="text"
                            name='email'
                            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Senha</label>
                        <input
                            type="password"
                            name='password'
                            className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-md bg-blue-600 py-2 text-white cursor-pointer
                     hover:bg-blue-800 duration-300"
                    >
                        Acessar
                    </button>
                    <div className='h-0.5 bg-gray-50'></div>
                    <p>Ainda não possui uma conta? cadastre-se agora</p>
                </form>


            </div>
        </div >

    );
}