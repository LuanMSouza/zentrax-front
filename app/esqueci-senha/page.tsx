'use client';

import Swal from 'sweetalert2';
import { useState } from 'react';
import { solicitarResetSenha } from './actions';

export default function EsqueciSenhaPage() {
    const [enviando, setEnviando] = useState(false);

    async function handleSubmit(formData: FormData) {
        setEnviando(true);
        try {
            const result = await solicitarResetSenha(formData);
            Swal.fire('Prontinho!', result.message, 'success');
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

                    <p className='absolute font-[Playwrite] inset-0 m-auto flex rotate-3
                    items-center justify-center z-10 overflow-hidden p-2 rounded-2xl text-4xl bg-black text-white w-fit h-fit text-center max-w-4/5'>
                        Calma, isso
                        <span className='font-[Bebas_Neue] text-5xl bg-blue-600 p-2 m-1'>
                            acontece!
                        </span>
                        vamos te ajudar a voltar
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

                    <h1 className="text-2xl font-bold text-gray-800">Esqueci minha senha</h1>

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
                        className="w-full rounded-md bg-blue-600 py-2 text-white cursor-pointer
                         hover:bg-blue-800 duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {enviando ? 'Enviando...' : 'Enviar link'}
                    </button>

                    <div className='h-0.5 bg-gray-50'></div>
                    <a href="/login" className="text-blue-600 text-sm hover:underline">Voltar para o login</a>
                </form>
            </div>
        </div>
    );
}
