"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import TopBar from "@/blocos/TopBar/pages";
import ClienteDetalhado from "@/modais/clienteDetalhado/page";
import { IconeOlho, IconeOlhoFechado } from "@/componentes/Icones";
import { FormatarValor, formatarDataBR, linkWhatsApp } from "@/lib/mask";
import { textoFrequencia } from "@/lib/cliente";
import { relatorioBack, Periodo } from "./actions";

type Dados = Extract<Awaited<ReturnType<typeof relatorioBack>>, { success: true }>
type Aba = 'maisPagou' | 'maisComprou' | 'melhorPagador' | 'maisDeve' | 'sumidos'

const ABAS: { chave: Aba, rotulo: string }[] = [
    { chave: 'maisPagou', rotulo: 'Mais pagou' },
    { chave: 'maisComprou', rotulo: 'Mais comprou' },
    { chave: 'melhorPagador', rotulo: 'Melhor pagador' },
    { chave: 'maisDeve', rotulo: 'Mais deve' },
    { chave: 'sumidos', rotulo: 'Sumidos' },
]

const PERIODOS: { chave: Periodo, rotulo: string }[] = [
    { chave: 'mes', rotulo: 'Este mês' },
    { chave: 'ano', rotulo: 'Este ano' },
    { chave: 'tudo', rotulo: 'Desde o início' },
]

// o que cada aba explica embaixo do título (a regra do cálculo, em uma linha)
const EXPLICA: Record<Aba, (p: Periodo) => string> = {
    // parte dos pagamentos antigos (feitos pelos botões da nota antes de set/2026) não ficou com data: no "Tudo" eles
    // entram pelo abatido das notas, no mês/ano não dá pra saber quando foram
    maisPagou: p => p === 'tudo' ? 'Soma de tudo que cada cliente já abateu nas notas.' : 'Soma dos pagamentos recebidos no período. Alguns pagamentos antigos ficaram sem data e não entram aqui.',
    maisComprou: () => 'Soma das notas lançadas no período, pagas ou não.',
    melhorPagador: () => 'Quem quita mais rápido: média de dias entre a nota e o pagamento que zerou ela. Precisa de 2 notas quitadas ou mais.',
    maisDeve: () => 'Quanto cada um deve agora (não depende do período).',
    sumidos: () => 'Clientes que compravam com frequência e pararam de aparecer (não depende do período).',
}

function dias(n: number) {
    const r = Math.round(n)
    return `${r} ${r === 1 ? 'dia' : 'dias'}`
}

function Variacao({ v }: { v: number | null }) {
    if (v === null) return <span className="text-xs text-slate-400">sem base pra comparar</span>
    const pct = Math.round(v * 100)
    const cls = pct > 0 ? 'text-emerald-700' : pct < 0 ? 'text-red-700' : 'text-slate-500'
    return <span className={`text-xs font-medium ${cls}`}>{pct > 0 ? '+' : ''}{pct}% <span className="font-normal text-slate-500">que no mesmo período anterior</span></span>
}

export default function Relatorios() {
    const [periodo, setPeriodo] = useState<Periodo>('mes')
    const [aba, setAba] = useState<Aba>('maisPagou')
    const [dados, setDados] = useState<Dados | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [mostrarValores, setMostrarValores] = useState(false)
    const [ficha, setFicha] = useState<{ id: number, nome: string } | null>(null)

    async function carregar(p: Periodo) {
        setCarregando(true)
        try {
            const res = await relatorioBack(p)
            if (res.success) {
                setDados(res)
                setErro(null)
            } else setErro(res.error)
        } catch (e) {
            console.error('Erro ao carregar relatórios:', e)
            setErro('Não deu pra carregar os relatórios agora.')
        } finally {
            setCarregando(false)
        }
    }

    useEffect(() => { carregar(periodo) }, [periodo])

    useEffect(() => {
        // mesma regra do dashboard: valores ocultos por padrão (tela de balcão), visíveis na demonstração
        try {
            if (JSON.parse(localStorage.getItem('empresa') ?? '{}')?.demo === true) setMostrarValores(true)
        } catch { }
    }, [])

    const valor = (v: number) => (mostrarValores ? FormatarValor(v) : 'R$ ••••')

    async function chamar(c: { nome: string, whatsapp: string | null }) {
        const primeiroNome = c.nome.trim().split(/\s+/)[0]
        const mensagem = `Oi, ${primeiroNome}! Tudo bem? Faz um tempinho que você não aparece por aqui, sentimos sua falta!`
        if (c.whatsapp) {
            window.open(linkWhatsApp(c.whatsapp, mensagem), '_blank')
            return
        }
        await navigator.clipboard.writeText(mensagem)
        Swal.fire('Copiado!', 'Esse cliente não tem WhatsApp cadastrado. A mensagem foi copiada.', 'success')
    }

    // uma linha da lista: posição, nome, valor principal e o detalhe embaixo
    function linhas(): { id: number, nome: string, apelido: string | null, principal: string, detalhe: string, extra?: React.ReactNode }[] {
        if (!dados) return []
        switch (aba) {
            case 'maisPagou':
                return dados.maisPagou.map(l => ({
                    ...l, principal: valor(l.valor),
                    detalhe: periodo === 'tudo'
                        ? `${l.quantidade} ${l.quantidade === 1 ? 'nota quitada' : 'notas quitadas'}`
                        : `${l.quantidade} ${l.quantidade === 1 ? 'pagamento' : 'pagamentos'}`
                }))
            case 'maisComprou':
                return dados.maisComprou.map(l => ({
                    ...l, principal: valor(l.valor),
                    detalhe: `${l.notas} ${l.notas === 1 ? 'nota' : 'notas'}, média de ${valor(l.valor / l.notas)}`
                }))
            case 'melhorPagador':
                return dados.melhorPagador.map(l => ({
                    ...l, principal: l.media < 0.5 ? 'no mesmo dia' : dias(l.media),
                    detalhe: `média de ${l.notas} notas, a mais demorada ${dias(l.maior)}`
                }))
            case 'maisDeve':
                return dados.maisDeve.map(l => ({
                    ...l, principal: valor(l.valor),
                    detalhe: `${l.notas} ${l.notas === 1 ? 'nota' : 'notas'}, desde ${formatarDataBR(l.maisAntiga)}`
                }))
            case 'sumidos':
                return dados.sumidos.map(l => ({
                    ...l, principal: `há ${dias(l.diasSemComprar)}`,
                    detalhe: `comprava ${textoFrequencia(l.intervalo)}${l.deve > 0 ? `, deve ${valor(l.deve)}` : ''}`,
                    extra: (
                        <button onClick={(e) => { e.stopPropagation(); chamar(l) }}
                            className="text-xs font-semibold bg-[#25D366] hover:brightness-95 text-white rounded-full px-3 py-1 cursor-pointer">
                            Chamar
                        </button>
                    )
                }))
        }
    }

    const lista = linhas()
    const periodoTexto = dados?.inicio
        ? `${formatarDataBR(dados.inicio)} a ${formatarDataBR(dados.fim)}`
        : 'todas as notas'

    return (
        <>
            <TopBar />
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">← Contas em aberto</Link>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Relatórios</h1>
                    </div>
                    <button
                        onClick={() => setMostrarValores(!mostrarValores)}
                        aria-pressed={mostrarValores}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ring-1 transition-all active:scale-[0.98] cursor-pointer ${mostrarValores ? 'bg-marca-100 text-marca-800 ring-marca-700/30' : 'bg-white text-slate-700 ring-slate-900/10 hover:ring-marca-700/40'}`}
                    >
                        {mostrarValores ? <IconeOlho /> : <IconeOlhoFechado />}
                        {mostrarValores ? 'Valores visíveis' : 'Valores ocultos'}
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-1 p-1 bg-slate-200/60 rounded-xl" role="tablist" aria-label="Período">
                        {PERIODOS.map(p => (
                            <button key={p.chave} role="tab" aria-selected={periodo === p.chave} onClick={() => setPeriodo(p.chave)}
                                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${periodo === p.chave ? 'bg-marca-950 text-white' : 'text-slate-600 hover:bg-slate-200/70'}`}>
                                {p.rotulo}
                            </button>
                        ))}
                    </div>
                    {dados && <span className="text-xs text-slate-500">{periodoTexto}</span>}
                </div>

                {dados?.totais && (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white ring-1 ring-slate-900/5 px-4 py-3">
                            <dt className="text-xs text-slate-500">Vendido no fiado</dt>
                            <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{valor(dados.totais.vendido)}</dd>
                            <dd><Variacao v={dados.totais.variacaoVendido} /></dd>
                        </div>
                        <div className="rounded-2xl bg-white ring-1 ring-slate-900/5 px-4 py-3">
                            <dt className="text-xs text-slate-500">Recebido</dt>
                            <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{valor(dados.totais.recebido)}</dd>
                            <dd><Variacao v={dados.totais.variacaoRecebido} /></dd>
                        </div>
                    </dl>
                )}

                <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
                    <div className="flex gap-1 p-1 bg-slate-200/60 rounded-xl w-max" role="tablist" aria-label="Ranking">
                        {ABAS.map(a => (
                            <button key={a.chave} role="tab" aria-selected={aba === a.chave} onClick={() => setAba(a.chave)}
                                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${aba === a.chave ? 'bg-marca-950 text-white' : 'text-slate-600 hover:bg-slate-200/70'}`}>
                                {a.rotulo}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="text-sm text-slate-500">{EXPLICA[aba](periodo)}</p>

                {erro && <p className="text-sm text-red-700">{erro}</p>}
                {carregando && !dados && <p className="text-sm text-slate-500 text-center py-8">Carregando...</p>}
                {dados && lista.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8 bg-white rounded-2xl ring-1 ring-slate-900/5">
                        {aba === 'sumidos' ? 'Ninguém sumido. Boa!' : 'Nada nesse período ainda.'}
                    </p>
                )}

                <ol className={`grid gap-2 transition-opacity ${carregando ? 'opacity-60' : ''}`}>
                    {lista.map((l, i) => (
                        // min-w-0: item de grid não encolhe abaixo do conteúdo, e nome comprido empurrava a linha
                        // pra fora da tela no celular (o truncate não chegava a cortar)
                        <li key={l.id} className="min-w-0">
                            <div role="button" tabIndex={0}
                                onClick={() => setFicha({ id: l.id, nome: l.nome })}
                                onKeyDown={(e) => { if (e.key === 'Enter') setFicha({ id: l.id, nome: l.nome }) }}
                                className="w-full bg-white rounded-xl ring-1 ring-slate-900/5 hover:ring-marca-700/40 transition-all px-4 py-3 flex items-center gap-3 cursor-pointer">
                                <span className={`w-7 shrink-0 text-center text-sm font-semibold tabular-nums ${i < 3 ? 'text-marca-700' : 'text-slate-400'}`}>{i + 1}º</span>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900 truncate">{l.nome}{l.apelido && <span className="font-normal text-slate-500"> ({l.apelido})</span>}</p>
                                    <p className="text-xs text-slate-500 truncate">{l.detalhe}</p>
                                </div>
                                <p className="font-semibold tabular-nums text-slate-900 text-right shrink-0">{l.principal}</p>
                                {l.extra}
                            </div>
                        </li>
                    ))}
                </ol>
            </main>

            {ficha && (
                <ClienteDetalhado
                    cliente={ficha}
                    sair={() => setFicha(null)}
                    atualizarClientes={() => carregar(periodo)}
                    atualizarPagamentos={() => { }}
                />
            )}
        </>
    )
}
