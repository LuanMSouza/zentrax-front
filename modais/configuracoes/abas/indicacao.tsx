'use client'

import { useEffect, useState } from "react"
import Swal from "sweetalert2"
import { obterIndicacao } from "@/app/indicacao/actions"

const LP_URL = 'https://zentrax.dvls.com.br/cadastro'

type Resumo = { codigo: string; indicadas: number; mesesGanhos: number; creditosPendentes: number; maximo: number }

export default function Indicacao() {
    const [resumo, setResumo] = useState<Resumo | null>(null)

    useEffect(() => {
        obterIndicacao().then(r => { if (r.success) setResumo(r.data) })
    }, [])

    if (!resumo) return null

    const link = `${LP_URL}?ref=${resumo.codigo}`

    async function copiar() {
        try {
            await navigator.clipboard.writeText(link)
            Swal.fire({ icon: 'success', title: 'Link copiado!', timer: 1400, showConfirmButton: false })
        } catch {
            Swal.fire('Copie manualmente', link, 'info')
        }
    }

    return (
        <div className="rounded border border-blue-100 bg-blue-50 p-4 space-y-3">
            <h3 className="font-semibold text-blue-700">Indique e ganhe</h3>
            <p className="text-sm text-gray-700">
                Para cada empresa que criar conta pelo seu link, você ganha <strong>1 mês grátis</strong>.
            </p>

            <div className="flex gap-2">
                <input readOnly value={link} className="flex-1 min-w-0 text-sm bg-white border border-gray-300 rounded px-3 py-2 text-gray-700" />
                <button onClick={copiar} className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white text-sm font-semibold px-4 rounded cursor-pointer">
                    Copiar
                </button>
            </div>

            <p className="text-xs text-gray-500">
                {resumo.indicadas} {resumo.indicadas === 1 ? 'indicação' : 'indicações'} · {resumo.mesesGanhos} {resumo.mesesGanhos === 1 ? 'mês ganho' : 'meses ganhos'}
                {resumo.creditosPendentes > 0 && ` · ${resumo.creditosPendentes} a aplicar na sua assinatura`}
                {` · limite de ${resumo.maximo} indicações com bônus`}
            </p>
        </div>
    )
}
