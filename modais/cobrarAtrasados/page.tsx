'use client'

import { useEffect, useMemo, useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import Titulo from "@/componentes/Titulo"
import { Button } from "@/componentes/Buttons"
import { ClienteEmAberto } from "@/types"
import { FormatarValor, formatarDataBR, linkWhatsApp } from "@/lib/mask"
import { CobrarBack } from "@/modais/clienteDetalhado/actions"

// Quem já foi cobrado hoje fica guardado no navegador: fechar no meio e abrir de novo continua de onde parou.
const CHAVE = 'cobradosHoje'
function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
function lerCobrados(): number[] {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
        return salvo?.dia === hojeISO() && Array.isArray(salvo.ids) ? salvo.ids : []
    } catch { return [] }
}
function salvarCobrados(ids: number[]) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ dia: hojeISO(), ids })) } catch { }
}

// Passa pelos atrasados um a um, com a mensagem de cobrança (a mesma do "Cobrar pelo WhatsApp" da ficha) pronta.
// Mais atrasado primeiro. Quem já foi cobrado hoje vai pro fim da fila.
export default function CobrarAtrasados({ emAberto, sair }: { emAberto: ClienteEmAberto[], sair: () => void }) {
    const [cobrados, setCobrados] = useState<number[]>([])
    const [fila, setFila] = useState<ClienteEmAberto[]>([])
    const [posicao, setPosicao] = useState(0)
    const [mensagem, setMensagem] = useState('')
    const [whatsapp, setWhatsapp] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(false)

    // a fila é montada uma vez ao abrir: cobrar alguém não pode reordenar a lista no meio do caminho
    useEffect(() => {
        const jaCobrados = lerCobrados()
        setCobrados(jaCobrados)
        const atrasados = emAberto
            .filter(c => c.atrasado)
            .sort((a, b) => new Date(a.mais_antiga).getTime() - new Date(b.mais_antiga).getTime())
        setFila([...atrasados.filter(c => !jaCobrados.includes(c.id)), ...atrasados.filter(c => jaCobrados.includes(c.id))])
    }, [emAberto])

    const atual = fila[posicao] ?? null
    const terminou = fila.length > 0 && posicao >= fila.length
    const cobradosNaFila = useMemo(() => fila.filter(c => cobrados.includes(c.id)).length, [fila, cobrados])

    useEffect(() => {
        if (!atual) return
        let vale = true
        setCarregando(true)
        setMensagem('')
        CobrarBack(atual.id)
            .then(res => {
                if (!vale) return
                setMensagem(res?.mensagem ?? '')
                setWhatsapp(res?.whatsapp ?? null)
            })
            .finally(() => vale && setCarregando(false))
        return () => { vale = false }
    }, [atual])

    function marcarEAvancar() {
        if (atual && !cobrados.includes(atual.id)) {
            const novos = [...cobrados, atual.id]
            setCobrados(novos)
            salvarCobrados(novos)
        }
        setPosicao(p => p + 1)
    }

    function mandar() {
        if (!whatsapp) return
        window.open(linkWhatsApp(whatsapp, mensagem), '_blank')
        marcarEAvancar()
    }

    async function copiar() {
        await navigator.clipboard.writeText(mensagem)
        Swal.fire({ title: 'Copiado!', text: 'Cole na conversa do cliente.', icon: 'success', timer: 1400, showConfirmButton: false })
        marcarEAvancar()
    }

    const secundario = "px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-50"

    return (
        <Cortina onClick={sair}>
            <Container tamanho="m">
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />
                <div className="pr-10">
                    <Titulo texto="Cobrar atrasados" cor="preto" />
                    <p className="text-sm text-slate-500 mt-0.5">
                        {fila.length === 0 ? 'Ninguém atrasado agora.' : `${fila.length} ${fila.length === 1 ? 'cliente atrasado' : 'clientes atrasados'}, do mais antigo pro mais recente.`}
                    </p>
                </div>

                {fila.length > 0 && (
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
                        <div className="h-full bg-marca-700 transition-all" style={{ width: `${(Math.min(posicao, fila.length) / fila.length) * 100}%` }} />
                    </div>
                )}

                {fila.length === 0 && (
                    <button onClick={sair} className="self-end px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-marca-700 hover:bg-marca-800 cursor-pointer">Fechar</button>
                )}

                {terminou && (
                    <div className="text-center py-4">
                        <p className="text-lg font-semibold text-slate-900">Pronto!!</p>
                        <p className="text-sm text-slate-500 mt-1">Hoje você já cobrou {cobradosNaFila} de {fila.length} atrasados.</p>
                        <div className="mt-5 flex justify-center gap-2">
                            <button onClick={() => setPosicao(0)} className={secundario}>Ver de novo</button>
                            <button onClick={sair} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-marca-700 hover:bg-marca-800 cursor-pointer">Fechar</button>
                        </div>
                    </div>
                )}

                {atual && (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs text-slate-400">{posicao + 1} de {fila.length}</p>
                                <p className="text-lg font-semibold text-slate-900 truncate">
                                    {atual.nome}{atual.apelido && <span className="font-normal text-slate-500"> ({atual.apelido})</span>}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {atual.quantidade_de_notas} {Number(atual.quantidade_de_notas) === 1 ? 'nota' : 'notas'} desde {formatarDataBR(atual.mais_antiga)}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-lg font-semibold tabular-nums text-slate-900">{FormatarValor(Number(atual.total))}</p>
                                {cobrados.includes(atual.id) && <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">já cobrado hoje</span>}
                            </div>
                        </div>

                        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                            Mensagem
                            <textarea value={carregando ? 'Montando a mensagem...' : mensagem} onChange={(e) => setMensagem(e.target.value)}
                                disabled={carregando} rows={5}
                                className="w-full bg-white rounded-lg ring-1 ring-slate-900/10 px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none focus:ring-2 focus:ring-marca-700 resize-y disabled:text-slate-400" />
                            {!carregando && !whatsapp && <span className="text-xs font-normal text-amber-700">Esse cliente não tem WhatsApp cadastrado. Dá pra copiar a mensagem.</span>}
                        </label>

                        <div className="flex items-center gap-2">
                            <button onClick={() => setPosicao(p => p + 1)} className="-ml-3 text-sm font-medium text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer">Pular</button>
                            <button onClick={copiar} disabled={carregando || !mensagem} className={`ml-auto ${secundario}`}>Copiar</button>
                            {whatsapp && (
                                <button onClick={mandar} disabled={carregando || !mensagem}
                                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-[#1faa53] hover:bg-[#178a43] cursor-pointer transition-colors disabled:opacity-50">
                                    Mandar no WhatsApp
                                </button>
                            )}
                        </div>
                    </>
                )}
            </Container>
        </Cortina>
    )
}
