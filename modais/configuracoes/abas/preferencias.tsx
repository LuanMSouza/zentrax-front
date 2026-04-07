import TextoCobrancaConfig from "@/modais/textoCobranca/pages"
import { useState } from "react"

export default function PreferenciasConfig() {

    const [abrirTextoCobranca, setAbrirTextoCobranca] = useState(false)

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Preferências do App</h2>

            <div className="flex items-center gap-3">
                <input type="checkbox" id="notif" className="accent-indigo-400 w-5 h-5" />
                <label htmlFor="notif">Avisar 4 dias antes de vencer a assinatura</label>
            </div>

            <div className="flex items-center gap-3 mt-5">
                <label htmlFor="cobranca">Selecione seu texto de cobrança</label>
                <button id="cobranca" onClick={() => setAbrirTextoCobranca(true)} className="bg-indigo-400 hover:bg-indigo-500 text-white py-2 px-4 rounded">
                    Clique aqui</button>
            </div>

            {abrirTextoCobranca && <TextoCobrancaConfig />}

        </div>
    )
}