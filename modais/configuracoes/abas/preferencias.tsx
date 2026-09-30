import TextoCobrancaConfig from "@/modais/textoCobranca/pages"
import { useEffect, useState } from "react"
import { AtualizarPreferencias, PegarPreferenciasBack } from "./actions"
import Swal from "sweetalert2"
import { esquecerCabecalho } from "@/lib/comprovante"

type Preferencias = {
    empresa_id: number,
    usar_papel_grande?: boolean,
    cobranca_text?: number,
    avisar: boolean,
    telefone?: string | null,
    endereco?: string | null,
    rodape_comprovante?: string | null
}

const camposComprovante = [
    { campo: 'telefone', rotulo: 'Telefone', placeholder: 'ex: (11) 99887-7665', max: 20 },
    { campo: 'endereco', rotulo: 'Endereço', placeholder: 'ex: Rua das Flores, 123 - Centro', max: 120 },
    { campo: 'rodape_comprovante', rotulo: 'Frase do rodapé', placeholder: 'Obrigado pela preferência!', max: 80 },
] as const

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
            esquecerCabecalho()
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
            <h2 className="text-xl font-semibold text-marca-700">Preferências do App</h2>

            <label
                htmlFor="notif"
                className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded p-3 cursor-pointer"
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
                    className="accent-marca-700 w-5 h-5 cursor-pointer shrink-0"
                />
                <span className="text-gray-700 text-sm md:text-base">Avisar 4 dias antes de vencer a assinatura</span>
            </label>

            <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded p-3">
                <span className="text-gray-700 text-sm md:text-base">Selecione seu texto de cobrança</span>
                <button
                    id="cobranca"
                    onClick={() => setAbrirTextoCobranca(true)}
                    className="cursor-pointer bg-marca-700 hover:bg-marca-800 active:scale-95 transition-all text-white py-2 px-4 rounded shrink-0"
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

            <div className="space-y-3 bg-gray-50 border border-gray-200 rounded p-3">
                <div>
                    <p className="text-gray-700 text-sm md:text-base font-medium">Comprovante impresso</p>
                    <p className="text-gray-500 text-xs md:text-sm">Sai no topo do comprovante, junto do nome da loja. O que ficar em branco não aparece.</p>
                </div>
                {camposComprovante.map(({ campo, rotulo, placeholder, max }) => (
                    <label key={campo} className="block">
                        <span className="text-gray-700 text-sm">{rotulo}</span>
                        <input
                            type="text"
                            maxLength={max}
                            placeholder={placeholder}
                            value={novasPreferencias?.[campo] ?? ''}
                            onChange={(e) => {
                                const valor = e.target.value;
                                setNovasPreferencias((prev) => ({ ...prev, [campo]: valor }));
                            }}
                            className="mt-1 w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm md:text-base text-gray-900 focus:outline-none focus:border-marca-700"
                        />
                    </label>
                ))}
            </div>

            <button
                onClick={hardRefresh}
                className="w-full py-2 bg-red-700 hover:bg-red-800 active:scale-95 transition-all text-white font-semibold cursor-pointer rounded"
            >
                Forçar atualização
            </button>

            {preferenciasSalvas !== novasPreferencias && (
                <button
                    onClick={enviar}
                    className="w-full bg-marca-700 hover:bg-marca-800 active:scale-95 transition-all text-white font-bold py-2 px-4 rounded"
                >
                    Salvar
                </button>
            )}

        </div>
    )
}