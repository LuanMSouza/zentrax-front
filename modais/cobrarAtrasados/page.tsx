'use client'

import { useEffect, useMemo, useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import Titulo from "@/componentes/Titulo"
import { Button } from "@/componentes/Buttons"
import { ClienteEmAberto } from "@/types"
import { FormatarValor, formatarDataBR, linkWhatsApp } from "@/lib/mask"
import { CobrarBack, mensagemLembreteBack } from "@/modais/clienteDetalhado/actions"

// Quem já foi cobrado (ou lembrado) hoje fica guardado no navegador: fechar no meio e abrir de novo continua de onde
// parou. Cada modo tem a sua lista.
const CHAVES = { atrasados: 'cobradosHoje', lembrete: 'lembradosHoje' } as const
export type ModoCobranca = keyof typeof CHAVES
function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
function lerCobrados(modo: ModoCobranca): number[] {
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVES[modo]) ?? 'null')
        return salvo?.dia === hojeISO() && Array.isArray(salvo.ids) ? salvo.ids : []
    } catch { return [] }
}
function salvarCobrados(modo: ModoCobranca, ids: number[]) {
    try { localStorage.setItem(CHAVES[modo], JSON.stringify({ dia: hojeISO(), ids })) } catch { }
}

// vence amanhã: o próximo dia combinado (a menor data entre as notas em aberto) é amanhã
function amanhaISO() {
    const d = new Date(`${hojeISO()}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
}
export function filaDoModo(emAberto: ClienteEmAberto[], modo: ModoCobranca) {
    if (modo === 'atrasados') {
        return emAberto.filter(c => c.atrasado).sort((a, b) => new Date(a.mais_antiga).getTime() - new Date(b.mais_antiga).getTime())
    }
    const amanha = amanhaISO()
    return emAberto
        .filter(c => !c.atrasado && (c.vence_hoje || c.proximo_vencimento?.slice(0, 10) === amanha))
        .sort((a, b) => Number(b.vence_hoje) - Number(a.vence_hoje) || a.nome.localeCompare(b.nome))
}

const TEXTOS = {
    atrasados: { titulo: 'Cobrar atrasados', resumo: (n: number) => `${n} ${n === 1 ? 'cliente atrasado' : 'clientes atrasados'}, do mais antigo pro mais recente.`, vazio: 'Ninguém atrasado agora.', feito: 'cobrou', marca: 'já cobrado hoje' },
    lembrete: { titulo: 'Lembrar vencimentos', resumo: (n: number) => `${n} ${n === 1 ? 'cliente combinou' : 'clientes combinaram'} de pagar hoje ou amanhã.`, vazio: 'Ninguém vence hoje nem amanhã.', feito: 'lembrou', marca: 'já lembrado hoje' },
}

// Passa pelos atrasados um a um, com a mensagem de cobrança (a mesma do "Cobrar pelo WhatsApp" da ficha) pronta.
// Mais atrasado primeiro. Quem já foi cobrado hoje vai pro fim da fila.
export default function CobrarAtrasados({ emAberto, sair, modo = 'atrasados' }: { emAberto: ClienteEmAberto[], sair: () => void, modo?: ModoCobranca }) {
    const t = TEXTOS[modo]
    const [cobrados, setCobrados] = useState<number[]>([])
    const [fila, setFila] = useState<ClienteEmAberto[]>([])
    const [posicao, setPosicao] = useState(0)
    const [mensagem, setMensagem] = useState('')
    const [whatsapp, setWhatsapp] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(false)

    // a fila é montada uma vez ao abrir: cobrar alguém não pode reordenar a lista no meio do caminho
    useEffect(() => {
        const jaCobrados = lerCobrados(modo)
        setCobrados(jaCobrados)
        const lista = filaDoModo(emAberto, modo)
        setFila([...lista.filter(c => !jaCobrados.includes(c.id)), ...lista.filter(c => jaCobrados.includes(c.id))])
    }, [emAberto, modo])

    const atual = fila[posicao] ?? null
    const terminou = fila.length > 0 && posicao >= fila.length
    const cobradosNaFila = useMemo(() => fila.filter(c => cobrados.includes(c.id)).length, [fila, cobrados])

    useEffect(() => {
        if (!atual) return
        let vale = true
        setCarregando(true)
        setMensagem('')
        ;(modo === 'lembrete' ? mensagemLembreteBack(atual.id) : CobrarBack(atual.id))
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
            salvarCobrados(modo, novos)
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
                    <Titulo texto={t.titulo} cor="preto" />
                    <p className="text-sm text-slate-500 mt-0.5">{fila.length === 0 ? t.vazio : t.resumo(fila.length)}</p>
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
                        <p className="text-sm text-slate-500 mt-1">Hoje você já {t.feito} {cobradosNaFila} de {fila.length} {fila.length === 1 ? 'cliente' : 'clientes'}.</p>
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
                                {cobrados.includes(atual.id) && <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">{t.marca}</span>}
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
