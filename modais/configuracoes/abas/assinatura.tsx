'use client'

import { useState } from "react"
import Swal from "sweetalert2"
import { criarPortalBack } from "@/app/assinatura/actions"
import AssinaturaModal from "@/modais/assinatura/pages"
import Indicacao from "./indicacao"

type AssinaturaConfigProps = {
    usuario: any
}

export default function AssinaturaConfig({ usuario }: AssinaturaConfigProps) {
    const [abrirEscolha, setAbrirEscolha] = useState(false)
    const [carregandoPortal, setCarregandoPortal] = useState(false)

    async function abrirPortal() {
        setCarregandoPortal(true)
        const response = await criarPortalBack()
        setCarregandoPortal(false)

        if (!response.success) {
            Swal.fire('Opa...', response.error, 'error')
            return
        }

        if (!response.data.url) {
            Swal.fire('Opa...', 'Erro ao abrir o portal.', 'error')
            return
        }

        window.location.href = response.data.url
    }

    if (usuario?.role !== 'gestor') {
        return (
            <div className="min-h-45 flex items-center justify-center text-center">
                <p className="text-gray-500">Essa área é somente para <strong>gestores</strong>.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-600">Assinatura</h2>

            <button
                onClick={() => setAbrirEscolha(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-semibold py-3 px-4 rounded cursor-pointer"
            >
                Assinar / renovar agora
            </button>

            <button
                onClick={abrirPortal}
                disabled={carregandoPortal}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all text-gray-800 font-semibold py-3 px-4 rounded border border-gray-300 disabled:opacity-50 cursor-pointer"
            >
                {carregandoPortal ? 'Abrindo...' : 'Gerenciar assinatura (cartão, faturas, cancelar)'}
            </button>

            <Indicacao />

            {abrirEscolha && <AssinaturaModal sair={() => setAbrirEscolha(false)} />}
        </div>
    )
}
