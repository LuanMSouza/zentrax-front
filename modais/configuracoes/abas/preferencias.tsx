import TextoCobrancaConfig from "@/modais/textoCobranca/pages"
import { useEffect, useState } from "react"
import { AtualizarPreferencias, PegarPreferenciasBack } from "./actions"
import Swal from "sweetalert2"

type Preferencias = {
    empresa_id: number,
    usar_papel_grande?: boolean,
    cobranca_text?: number,
    avisar: boolean
}

export default function PreferenciasConfig({ sair }: { sair: () => void }) {

    const [preferenciasSalvas, setPreferenciasSalvas] = useState<Preferencias | null>(null)

    const [novasPreferencias, setNovasPreferencias] = useState<Preferencias>({
        empresa_id: 0,
        avisar: false,
        usar_papel_grande: false,
        cobranca_text: 0
    });
    const pegarDados = async () => {
        const response = await PegarPreferenciasBack()

        if (response.success) {
            setPreferenciasSalvas(response.data as Preferencias);
            setNovasPreferencias(response.data as Preferencias);
        }
        if (!response.success) {
            Swal.fire(`Opa...`, response.error, `error`)
        }
    }

    useEffect(() => {
        pegarDados()
    }, [])

    const enviar = async () => {

        const response = await AtualizarPreferencias(novasPreferencias)

        if (response.success) {
            Swal.fire(`Sucesso!!`, ``, `success`)
            sair()
        } else if (!response.success && response.error) {
            Swal.fire(`Opa...`, response.error, `error`)
        }
    }

    const [abrirTextoCobranca, setAbrirTextoCobranca] = useState(false)

    const hardRefresh = async () => {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                registration.unregister();
            }
        }
        window.location.href = window.location.href;
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-indigo-400">Preferências do App</h2>

            <label
                htmlFor="notif"
                className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded p-3 cursor-pointer"
            >
                <input
                    type="checkbox"
                    id="notif"
                    checked={novasPreferencias?.avisar || false}
                    onChange={(e) => {
                        const valor = e.target.checked;
                        setNovasPreferencias((prev) => ({
                            ...prev,
                            avisar: valor
                        }));
                    }}
                    className="accent-indigo-400 w-5 h-5 cursor-pointer shrink-0"
                />
                <span className="text-gray-300 text-sm md:text-base">Avisar 4 dias antes de vencer a assinatura</span>
            </label>

            <div className="flex items-center justify-between gap-3 bg-gray-800 border border-gray-700 rounded p-3">
                <span className="text-gray-300 text-sm md:text-base">Selecione seu texto de cobrança</span>
                <button
                    id="cobranca"
                    onClick={() => setAbrirTextoCobranca(true)}
                    className="cursor-pointer bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all text-white py-2 px-4 rounded shrink-0"
                >
                    Clique aqui
                </button>
            </div>

            {abrirTextoCobranca &&
                <TextoCobrancaConfig
                    set={(id) => setNovasPreferencias((prev) => ({
                        ...prev,
                        cobranca_text: id ?? undefined,
                        avisar: prev?.avisar ?? false
                    }))}
                    selecionada={preferenciasSalvas?.cobranca_text || 0}
                    sair={() => setAbrirTextoCobranca(false)}
                />}

            <button
                onClick={hardRefresh}
                className="w-full py-2 bg-red-700 hover:bg-red-800 active:scale-95 transition-all text-white font-semibold cursor-pointer rounded"
            >
                Forçar atualização
            </button>

            {preferenciasSalvas !== novasPreferencias && (
                <button
                    onClick={enviar}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all text-white font-bold py-2 px-4 rounded"
                >
                    Salvar
                </button>
            )}

        </div>
    )
}