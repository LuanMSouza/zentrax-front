'use client'

import { useState } from "react"

// Botão de copiar o Pix copia e cola: no celular, o cliente cola direto no app do banco
export default function CopiarPix({ codigo }: { codigo: string }) {
    const [copiado, setCopiado] = useState(false)

    async function copiar() {
        try {
            await navigator.clipboard.writeText(codigo)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2500)
        } catch {
            window.prompt('Copie o código Pix:', codigo)
        }
    }

    return (
        <button onClick={copiar}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-marca-700 hover:bg-marca-800 active:scale-[0.98] transition-all cursor-pointer">
            {copiado ? 'Copiado! Agora cole no app do banco' : 'Copiar código Pix'}
        </button>
    )
}
