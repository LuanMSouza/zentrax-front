import TextoCobrancaConfig from "@/modais/textoCobranca/pages"
import { useEffect, useState } from "react"
import { AtualizarPreferencias, PegarPreferenciasBack } from "./actions"
import Swal from "sweetalert2"
import { Button } from "@/componentes/Buttons"

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
            <h2 className="text-xl font-semibold">Preferências do App</h2>

            <div className="flex items-center gap-3">
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
                    className="accent-indigo-400 w-5 h-5 cursor-pointer"
                />
                <label className="cursor-pointer text-sm md:text-base" htmlFor="notif">Avisar 4 dias antes de vencer a assinatura</label>
            </div>

            <div className="flex items-center gap-3 mt-5">
                <label className="text-sm md:text-base" htmlFor="cobranca">Selecione seu texto de cobrança</label>
                <button id="cobranca" onClick={() => setAbrirTextoCobranca(true)} className="cursor-pointer bg-indigo-400 hover:bg-indigo-500 text-white py-2 px-4 rounded">
                    Clique aqui</button>
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

            {/* ver se teve alteracao */}

            <button onClick={hardRefresh} className=" w-full pc-2 py-1 bg-red-600 text-white font-bold cursor-pointer rounded">Forçar atualiação</button>

            {preferenciasSalvas !== novasPreferencias && (
                <div className="w-full flex alig-center justify-center">
                    <Button onClick={enviar} tamanho="g" tipo="btn01" corTexto="branco" texto="Salvar" />
                </div>
            )}

        </div>
    )
}