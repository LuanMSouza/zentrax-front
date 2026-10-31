'use client'

import { useEffect, useState } from "react"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import Titulo from "@/componentes/Titulo"
import { Button } from "@/componentes/Buttons"
import { FormatarValor } from "@/lib/mask"
import { imprimirFechamento } from "@/lib/comprovante"
import { fechamentoDoDiaBack } from "./actions"

type Dados = Extract<Awaited<ReturnType<typeof fechamentoDoDiaBack>>, { success: true }>

function hojeISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function somarDias(dia: string, n: number) {
    const d = new Date(`${dia}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export default function FechamentoDia({ sair }: { sair: () => void }) {
    const hoje = hojeISO()
    const [dia, setDia] = useState(hoje)
    const [dados, setDados] = useState<Dados | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(true)

    useEffect(() => {
        let atual = true
        setCarregando(true)
        fechamentoDoDiaBack(dia)
            .then(res => {
                if (!atual) return
                if (res.success) { setDados(res); setErro(null) }
                else setErro(res.error)
            })
            .catch(() => atual && setErro('Não deu pra carregar o fechamento agora.'))
            .finally(() => atual && setCarregando(false))
        return () => { atual = false }
    }, [dia])

    const rotuloDia = dia === hoje ? 'Hoje' : dia === somarDias(hoje, -1) ? 'Ontem' : DIAS_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()]
    const botaoSeta = "p-2 rounded-lg ring-1 ring-slate-900/10 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"

    return (
        <Cortina onClick={sair}>
            <Container tamanho="m">
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />
                <div className="pr-10">
                    <Titulo texto="Fechamento do dia" cor="preto" />
                    <p className="text-sm text-slate-500 mt-0.5">O que entrou no caixa, separado por forma de pagamento.</p>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className={botaoSeta}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <label className="flex-1 flex items-center gap-2 rounded-lg ring-1 ring-slate-900/10 px-3 py-1.5">
                        <span className="text-sm font-medium text-slate-700 capitalize">{rotuloDia}</span>
                        <input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)}
                            className="ml-auto text-sm text-slate-600 bg-transparent outline-none cursor-pointer" />
                    </label>
                    <button onClick={() => setDia(somarDias(dia, 1))} disabled={dia >= hoje} aria-label="Próximo dia" className={botaoSeta}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                </div>

                {erro && <p className="text-sm text-red-600 text-center py-4">{erro}</p>}

                {dados && !erro && (
                    <div className={`flex flex-col gap-4 transition-opacity ${carregando ? 'opacity-50' : ''}`}>
                        <div className="rounded-xl bg-marca-950 text-white px-4 py-3">
                            <p className="text-xs text-slate-300">Total recebido</p>
                            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{FormatarValor(dados.recebido)}</p>
                        </div>

                        {dados.formas.length > 0 ? (
                            <ul className="rounded-xl ring-1 ring-slate-900/5 divide-y divide-slate-100">
                                {dados.formas.map(f => (
                                    <li key={f.forma} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                                        <span className="text-slate-700">{f.nome} <span className="text-slate-400">({f.qtd})</span></span>
                                        <span className="font-medium tabular-nums text-slate-900">{FormatarValor(f.total)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-2">Nenhum pagamento registrado nesse dia.</p>
                        )}

                        <p className="text-sm text-slate-600 flex items-center justify-between gap-3 px-1">
                            <span>Vendido fiado ({dados.notasLancadas} {dados.notasLancadas === 1 ? 'nota' : 'notas'})</span>
                            <span className="font-medium tabular-nums text-slate-900">{FormatarValor(dados.vendidoFiado)}</span>
                        </p>

                        {dados.pagamentos.length > 0 && (
                            <details className="group">
                                <summary className="cursor-pointer select-none list-none text-sm font-medium text-slate-700 flex items-center justify-between">
                                    Ver os {dados.pagamentos.length} pagamentos
                                    <span className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
                                </summary>
                                <ul className="mt-2 max-h-60 overflow-y-auto divide-y divide-slate-100 text-sm">
                                    {dados.pagamentos.map(p => (
                                        <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                                            <span className="min-w-0">
                                                <span className="block text-slate-900 truncate">{p.cliente}</span>
                                                <span className="block text-xs text-slate-500">{p.hora} · {p.forma}{p.atendente ? ` · ${p.atendente}` : ''}</span>
                                            </span>
                                            <span className="tabular-nums text-slate-900 shrink-0">{FormatarValor(p.valor)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}

                        <button onClick={() => imprimirFechamento(dados)}
                            className="self-end px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50 cursor-pointer transition-colors">
                            Imprimir fechamento
                        </button>
                    </div>
                )}

                {!dados && !erro && <p className="text-sm text-slate-500 text-center py-6">Carregando...</p>}
            </Container>
        </Cortina>
    )
}
