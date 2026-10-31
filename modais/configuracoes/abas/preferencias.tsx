import TextoCobrancaConfig from "@/modais/textoCobranca/pages"
import { useEffect, useState } from "react"
import { AtualizarPreferencias, PegarPreferenciasBack } from "./actions"
import Swal from "sweetalert2"
import { esquecerCabecalho } from "@/lib/comprovante"
import { configJurosDe, jurosDaNota, MAX_JUROS_MES, MAX_MULTA, MAX_CARENCIA } from "@/lib/juros"
import { FormatarValor } from "@/lib/mask"

type Preferencias = {
    empresa_id: number,
    usar_papel_grande?: boolean,
    cobranca_text?: number,
    avisar: boolean,
    avisar_vencimentos?: boolean,
    telefone?: string | null,
    endereco?: string | null,
    rodape_comprovante?: string | null,
    juros_ativo?: boolean,
    juros_mes?: number | string,
    multa_atraso?: number | string,
    juros_carencia?: number | string
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
            // 0 que vem do banco nos campos de juros aparece vazio (com o placeholder), senão digitar 1 vira "01"
            const dados = { ...response.data } as Preferencias
            for (const k of ['juros_mes', 'multa_atraso', 'juros_carencia'] as const) if (Number(dados[k] ?? 0) === 0) dados[k] = ''
            setPreferenciasSalvas(dados);
            setNovasPreferencias(dados);
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

    // exportar é só pra gestor (o servidor confere de novo); o papel vem do login
    const [ehGestor, setEhGestor] = useState(false)
    useEffect(() => {
        try { setEhGestor(JSON.parse(localStorage.getItem('usuario') ?? '{}')?.role === 'gestor') } catch { }
    }, [])

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

            <label
                htmlFor="aviso-vencimentos"
                className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded p-3 cursor-pointer"
            >
                <input
                    type="checkbox"
                    id="aviso-vencimentos"
                    checked={novasPreferencias?.avisar_vencimentos !== false}
                    onChange={(e) => {
                        const valor = e.target.checked;
                        setNovasPreferencias((prev) => ({ ...prev, avisar_vencimentos: valor }));
                    }}
                    className="accent-marca-700 w-5 h-5 cursor-pointer shrink-0"
                />
                <span className="text-gray-700 text-sm md:text-base">Me avisar por e-mail, de manhã, quando um fiado vence ou atrasa</span>
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

            {ehGestor && (
                <JurosConfig valor={novasPreferencias} onChange={(campos) => setNovasPreferencias(prev => ({ ...prev, ...campos }))} />
            )}

            {ehGestor && (
                <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded p-3">
                    <div>
                        <p className="text-gray-700 text-sm md:text-base font-medium">Seus dados</p>
                        <p className="text-gray-500 text-xs md:text-sm">Planilha do Excel com todos os clientes, notas e pagamentos.</p>
                    </div>
                    <a href="/api/exportar" download
                        className="cursor-pointer bg-marca-700 hover:bg-marca-800 active:scale-95 transition-all text-white py-2 px-4 rounded shrink-0 text-sm md:text-base">
                        Baixar planilha
                    </a>
                </div>
            )}

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

// Juros por atraso: só gestor vê (o servidor também só grava se for gestor). Mostra um exemplo com os números
// digitados, pra ficar claro o que o cliente vai ver.
function JurosConfig({ valor, onChange }: { valor: Preferencias, onChange: (campos: Partial<Preferencias>) => void }) {
    const ativo = valor.juros_ativo === true
    const config = configJurosDe({ ...valor, juros_ativo: true, juros_mes: String(valor.juros_mes ?? 0).replace(',', '.'), multa_atraso: String(valor.multa_atraso ?? 0).replace(',', '.') })
    const exemplo = jurosDaNota(100, { data: '2026-01-01', vencimento: '2026-01-01' }, config, '2026-01-16')
    const campo = "mt-1 w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm md:text-base text-gray-900 focus:outline-none focus:border-marca-700"
    const mostrar = (v: unknown) => String(v ?? '')

    return (
        <div className="space-y-3 bg-gray-50 border border-gray-200 rounded p-3">
            <label htmlFor="juros" className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="juros" checked={ativo} onChange={(e) => onChange({ juros_ativo: e.target.checked })}
                    className="accent-marca-700 w-5 h-5 cursor-pointer shrink-0" />
                <span>
                    <span className="block text-gray-700 text-sm md:text-base font-medium">Cobrar juros por atraso</span>
                    <span className="block text-gray-500 text-xs md:text-sm">Opcional. Mostra o valor com juros na ficha, na cobrança e no link do extrato. O pagamento continua sendo registrado normalmente na nota.</span>
                </span>
            </label>

            {ativo && (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <label className="block">
                            <span className="text-gray-700 text-sm">Juros ao mês (%)</span>
                            <input inputMode="decimal" value={mostrar(valor.juros_mes)} max={MAX_JUROS_MES} placeholder="ex: 1"
                                onChange={(e) => onChange({ juros_mes: e.target.value })} className={campo} />
                        </label>
                        <label className="block">
                            <span className="text-gray-700 text-sm">Multa (%)</span>
                            <input inputMode="decimal" value={mostrar(valor.multa_atraso)} max={MAX_MULTA} placeholder="ex: 2"
                                onChange={(e) => onChange({ multa_atraso: e.target.value })} className={campo} />
                        </label>
                        <label className="block">
                            <span className="text-gray-700 text-sm">Tolerância (dias)</span>
                            <input inputMode="numeric" value={mostrar(valor.juros_carencia)} max={MAX_CARENCIA} placeholder="ex: 5"
                                onChange={(e) => onChange({ juros_carencia: e.target.value })} className={campo} />
                        </label>
                    </div>
                    <p className="text-gray-500 text-xs md:text-sm">
                        Conta a partir do dia combinado. Nota sem dia combinado conta 30 dias depois da compra, igual ao "atrasado" da tela principal.
                        A lei do consumidor limita a multa a 2%.
                    </p>
                    <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded px-3 py-2">
                        Exemplo: uma nota de R$ 100,00 com 15 dias de atraso fica {FormatarValor(100 + exemplo.valor)}
                        {exemplo.valor === 0 && config.carencia >= 15 ? ' (ainda dentro da tolerância)' : ''}.
                    </p>
                </>
            )}
        </div>
    )
}
