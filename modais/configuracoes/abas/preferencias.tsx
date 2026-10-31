import TextoCobrancaConfig from "@/modais/textoCobranca/pages"
import { useEffect, useState } from "react"
import { AtualizarPreferencias, PegarPreferenciasBack } from "./actions"
import Swal from "sweetalert2"
import { esquecerCabecalho } from "@/lib/comprovante"
import { configJurosDe, jurosDaNota, MAX_JUROS_MES, MAX_MULTA, MAX_CARENCIA } from "@/lib/juros"
import { FormatarValor } from "@/lib/mask"
import { chavePixValida, codigoPix } from "@/lib/pix"
import qrcode from "qrcode-generator"

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
    juros_carencia?: number | string,
    logo_comprovante?: string | null,
    resumo_mensal?: boolean,
    pix_chave?: string | null,
    pix_nome?: string | null,
    pix_cidade?: string | null
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

    // Tudo numa tela só ficou comprido demais: as preferências viraram seções. O estado e o Salvar são um só,
    // então dá pra mexer em várias seções e salvar de uma vez.
    const secoes = [
        { id: 'avisos', nome: 'Avisos' },
        { id: 'cobranca', nome: 'Cobrança' },
        { id: 'comprovante', nome: 'Comprovante' },
        ...(ehGestor ? [{ id: 'pix', nome: 'Pix' }] : []),
        { id: 'dados', nome: 'Dados' },
    ] as const
    const [secao, setSecao] = useState<typeof secoes[number]['id']>('avisos')
    const caixa = "flex items-center gap-3 bg-gray-50 border border-gray-200 rounded p-3 cursor-pointer"
    const marcar = (campo: 'avisar' | 'avisar_vencimentos' | 'resumo_mensal', valor: boolean) =>
        setNovasPreferencias((prev) => ({ ...prev, [campo]: valor }))

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit" role="tablist" aria-label="Seções das preferências">
                {secoes.map(s => (
                    <button key={s.id} role="tab" aria-selected={secao === s.id} onClick={() => setSecao(s.id)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${secao === s.id ? 'bg-white text-marca-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                        {s.nome}
                    </button>
                ))}
            </div>

            {secao === 'avisos' && (
                <>
                    <label htmlFor="notif" className={caixa}>
                        <input type="checkbox" id="notif" checked={novasPreferencias?.avisar || false}
                            onChange={(e) => marcar('avisar', e.target.checked)}
                            className="accent-marca-700 w-5 h-5 cursor-pointer shrink-0" />
                        <span className="text-gray-700 text-sm md:text-base">Avisar 4 dias antes de vencer a assinatura</span>
                    </label>
                    <label htmlFor="aviso-vencimentos" className={caixa}>
                        <input type="checkbox" id="aviso-vencimentos" checked={novasPreferencias?.avisar_vencimentos !== false}
                            onChange={(e) => marcar('avisar_vencimentos', e.target.checked)}
                            className="accent-marca-700 w-5 h-5 cursor-pointer shrink-0" />
                        <span className="text-gray-700 text-sm md:text-base">Me avisar por e-mail, de manhã, quando um fiado vence ou atrasa</span>
                    </label>
                    <label htmlFor="resumo-mensal" className={caixa}>
                        <input type="checkbox" id="resumo-mensal" checked={novasPreferencias?.resumo_mensal !== false}
                            onChange={(e) => marcar('resumo_mensal', e.target.checked)}
                            className="accent-marca-700 w-5 h-5 cursor-pointer shrink-0" />
                        <span className="text-gray-700 text-sm md:text-base">Mandar por e-mail, todo dia 1º, o resumo do mês (vendido, recebido, quem mais deve)</span>
                    </label>
                </>
            )}

            {secao === 'cobranca' && (
                <>
                    <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded p-3">
                        <span className="text-gray-700 text-sm md:text-base">Texto da mensagem de cobrança</span>
                        <button
                            id="cobranca"
                            onClick={() => setAbrirTextoCobranca(true)}
                            className="cursor-pointer bg-marca-700 hover:bg-marca-800 active:scale-95 transition-all text-white py-2 px-4 rounded shrink-0"
                        >
                            Escolher
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

                    {ehGestor && (
                        <JurosConfig valor={novasPreferencias} onChange={(campos) => setNovasPreferencias(prev => ({ ...prev, ...campos }))} />
                    )}
                </>
            )}

            {secao === 'comprovante' && (
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded p-3">
                    <p className="text-gray-500 text-xs md:text-sm">Sai no topo do comprovante, junto do nome da loja. O que ficar em branco não aparece.</p>
                    <LogoComprovante valor={novasPreferencias?.logo_comprovante ?? null}
                        onChange={(logo) => setNovasPreferencias(prev => ({ ...prev, logo_comprovante: logo }))} />
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
            )}

            {secao === 'pix' && ehGestor && (
                <PixConfig valor={novasPreferencias} onChange={(campos) => setNovasPreferencias(prev => ({ ...prev, ...campos }))} />
            )}

            {secao === 'dados' && (
                <>
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
                    <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded p-3">
                        <div>
                            <p className="text-gray-700 text-sm md:text-base font-medium">App travado ou desatualizado?</p>
                            <p className="text-gray-500 text-xs md:text-sm">Recarrega o ZentraX do zero, com a versão mais nova.</p>
                        </div>
                        <button onClick={hardRefresh}
                            className="cursor-pointer bg-red-700 hover:bg-red-800 active:scale-95 transition-all text-white py-2 px-4 rounded shrink-0 text-sm md:text-base">
                            Forçar atualização
                        </button>
                    </div>
                </>
            )}

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

// Pix da loja: vai no comprovante (QR com o valor que falta), na cobrança e no link do extrato. Só gestor mexe,
// porque é pra onde o dinheiro vai. O QR de teste deixa conferir no app do banco antes de usar com cliente.
function PixConfig({ valor, onChange }: { valor: Preferencias, onChange: (campos: Partial<Preferencias>) => void }) {
    const chave = valor.pix_chave ?? ''
    const valida = chave.trim() !== '' && chavePixValida(chave)
    const teste = valida ? codigoPix({ chave, nome: valor.pix_nome ?? '', cidade: valor.pix_cidade ?? '' }, 1) : null
    let svg = ''
    if (teste) {
        const qr = qrcode(0, 'M')
        qr.addData(teste)
        qr.make()
        svg = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true })
    }
    const campo = "mt-1 w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm md:text-base text-gray-900 focus:outline-none focus:border-marca-700"

    return (
        <div className="space-y-3 bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-gray-500 text-xs md:text-sm">
                Com o Pix configurado, o comprovante, a cobrança e o link do extrato já mostram um QR code com o valor que falta.
                Deixe a chave em branco pra não usar.
            </p>
            <label className="block">
                <span className="text-gray-700 text-sm">Chave Pix</span>
                <input value={chave} maxLength={77} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                    onChange={(e) => onChange({ pix_chave: e.target.value })} className={campo} />
                {chave.trim() !== '' && !valida && (
                    <span className="block text-xs text-red-600 mt-1">Essa chave não parece válida. Celular vai com DDD, ex.: (13) 99999-8888.</span>
                )}
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-gray-700 text-sm">Nome de quem recebe</span>
                    <input value={valor.pix_nome ?? ''} maxLength={25} placeholder="ex: Maria Silva"
                        onChange={(e) => onChange({ pix_nome: e.target.value })} className={campo} />
                </label>
                <label className="block">
                    <span className="text-gray-700 text-sm">Cidade</span>
                    <input value={valor.pix_cidade ?? ''} maxLength={15} placeholder="ex: Santos"
                        onChange={(e) => onChange({ pix_cidade: e.target.value })} className={campo} />
                </label>
            </div>
            {teste && (
                <div className="flex items-center gap-3 bg-white border border-gray-200 rounded p-3">
                    <div className="w-24 h-24 shrink-0 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
                    <p className="text-xs md:text-sm text-gray-600">
                        <span className="font-medium text-gray-800">Teste antes de usar:</span> abra o app do banco, escolha pagar com Pix e aponte pra esse QR (R$ 1,00).
                        Confira se aparece o nome certo. Não precisa pagar.
                    </p>
                </div>
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


// Reduz a imagem pra largura da bobina da térmica (58mm a 203dpi = 384 pontos), em tons de cinza e fundo branco
// (PNG transparente sai preto em algumas impressoras). Fica pequena o bastante pra guardar no banco.
function prepararLogo(arquivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo)
        const img = new Image()
        img.onload = () => {
            const escala = Math.min(1, 384 / img.width, 160 / img.height)
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(img.width * escala))
            canvas.height = Math.max(1, Math.round(img.height * escala))
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.filter = 'grayscale(1)'
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            URL.revokeObjectURL(url)
            resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')) }
        img.src = url
    })
}

function LogoComprovante({ valor, onChange }: { valor: string | null, onChange: (logo: string | null) => void }) {
    async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
        const arquivo = e.target.files?.[0]
        e.target.value = ''
        if (!arquivo) return
        try {
            const logo = await prepararLogo(arquivo)
            if (logo.length > 200_000) {
                Swal.fire('Opa...', 'Essa imagem ficou grande demais. Tente uma logo mais simples.', 'warning')
                return
            }
            onChange(logo)
        } catch {
            Swal.fire('Opa...', 'Não deu pra abrir essa imagem. Tente um PNG ou JPG.', 'error')
        }
    }

    return (
        <div>
            <span className="text-gray-700 text-sm">Logo (opcional)</span>
            <div className="mt-1 flex items-center gap-3">
                {valor
                    ? <img src={valor} alt="Logo atual" className="h-14 max-w-40 object-contain bg-white border border-gray-200 rounded p-1" />
                    : <span className="h-14 w-24 grid place-items-center text-xs text-gray-400 bg-white border border-dashed border-gray-300 rounded">sem logo</span>}
                <label className="cursor-pointer text-sm font-medium text-marca-700 hover:text-marca-800">
                    {valor ? 'Trocar' : 'Escolher imagem'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={escolher} className="sr-only" />
                </label>
                {valor && (
                    <button type="button" onClick={() => onChange(null)} className="text-sm text-red-600 hover:text-red-700 cursor-pointer">Tirar</button>
                )}
            </div>
            <p className="text-gray-500 text-xs mt-1">Sai em preto e branco no topo do comprovante. Logo simples, com fundo branco, fica melhor.</p>
        </div>
    )
}
