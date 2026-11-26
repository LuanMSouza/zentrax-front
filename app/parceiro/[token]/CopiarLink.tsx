'use client'

import { useState } from "react"

export default function CopiarLink({ link }: { link: string }) {
    const [copiado, setCopiado] = useState(false)

    async function copiar() {
        try {
            await navigator.clipboard.writeText(link)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
        } catch { /* sem permissão de área de transferência: o campo ao lado deixa copiar na mão */ }
    }

    return (
        <div className="flex gap-2 mt-2">
            <input readOnly value={link} className="flex-1 min-w-0 text-sm bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-700" />
            <button onClick={copiar} className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white text-sm font-semibold px-4 rounded cursor-pointer">
                {copiado ? 'Copiado!' : 'Copiar'}
            </button>
        </div>
    )
}
