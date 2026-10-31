'use client'

import { FormatarValor, formatarDataBR, diasDesde } from "@/lib/mask"
import { seloPagador, estaSumido, textoFrequencia, textoAniversario } from "@/lib/cliente"
import { resumoDoClienteBack } from "./actions"

export type DadosResumo = Extract<Awaited<ReturnType<typeof resumoDoClienteBack>>, { success: true }>

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function dias(n: number) {
    const r = Math.round(n)
    return `${r} ${r === 1 ? 'dia' : 'dias'}`
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string, valor: string, detalhe?: string | null }) {
    return (
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-900/5 px-4 py-3">
            <dt className="text-xs text-slate-500">{rotulo}</dt>
            <dd className="mt-0.5 text-lg sm:text-xl font-semibold tabular-nums text-slate-900">{valor}</dd>
            {detalhe && <dd className="text-xs text-slate-500 mt-0.5">{detalhe}</dd>}
        </div>
    )
}

export default function Resumo({ dados }: { dados: DadosResumo }) {
    const { resumo: r, cadastro: c, meses } = dados
    const selo = seloPagador(r.mediaDiasQuitar, r.notasQuitadas)
    const sumido = estaSumido(r.intervaloMedio, r.diasSemComprar)
    const diasAberta = diasDesde(r.abertaMaisAntiga)
    const maiorMes = Math.max(1, ...meses.flatMap(m => [m.comprado, m.pago]))
    const aniversario = textoAniversario(c.aniversario_dia, c.aniversario_mes)

    if (r.notasTotal === 0) {
        return <p className="text-sm text-slate-500 text-center py-6">Esse cliente ainda não tem nenhuma nota.</p>
    }

    return (
        <div className="flex flex-col gap-4">
            {(selo || sumido) && (
                <div className="flex flex-wrap gap-2 text-sm">
                    {selo && <span className={`inline-flex px-2.5 py-1 rounded-full ring-1 ring-inset font-medium ${selo.cls}`}>{selo.rotulo}</span>}
                    {sumido && (
                        <span className="inline-flex px-2.5 py-1 rounded-full ring-1 ring-inset font-medium bg-violet-50 text-violet-700 ring-violet-600/20">
                            sumido: comprava {textoFrequencia(r.intervaloMedio)} e não volta há {dias(r.diasSemComprar!)}
                        </span>
                    )}
                </div>
            )}

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Numero
                    rotulo={r.qtdUltimas < 5 ? `Média das ${r.qtdUltimas} notas` : 'Média das últimas 5 notas'}
                    valor={r.mediaUltimas != null ? FormatarValor(r.mediaUltimas) : '-'}
                />
                <Numero
                    rotulo="Leva pra quitar"
                    valor={r.mediaDiasQuitar != null ? `${dias(r.mediaDiasQuitar)}` : '-'}
                    detalhe={r.notasQuitadas > 0
                        ? `média de ${r.notasQuitadas} ${r.notasQuitadas === 1 ? 'nota quitada' : 'notas quitadas'}${r.maiorDemora != null && r.notasQuitadas > 1 ? `, a mais demorada ${dias(r.maiorDemora)}` : ''}`
                        : 'nenhuma nota quitada com data de pagamento'}
                />
                <Numero
                    rotulo="Nota aberta mais antiga"
                    valor={diasAberta != null ? `há ${dias(diasAberta)}` : 'nenhuma'}
                    detalhe={r.abertaMaisAntiga ? `de ${formatarDataBR(r.abertaMaisAntiga)}` : null}
                />
                <Numero rotulo="Neste mês" valor={FormatarValor(r.valorMes)} detalhe={`${r.notasMes} ${r.notasMes === 1 ? 'nota' : 'notas'}`} />
                <Numero rotulo="Neste ano" valor={FormatarValor(r.valorAno)} detalhe={`${r.notasAno} ${r.notasAno === 1 ? 'nota' : 'notas'}`} />
                <Numero
                    rotulo="Compra"
                    valor={textoFrequencia(r.intervaloMedio) ?? '-'}
                    detalhe={r.ultimaCompra ? `última em ${formatarDataBR(r.ultimaCompra)}` : null}
                />
                <Numero rotulo="Já comprou no total" valor={FormatarValor(r.totalComprado)} detalhe={`${r.notasTotal} notas desde ${formatarDataBR(r.clienteDesde)}`} />
                <Numero rotulo="Já pagou no total" valor={FormatarValor(r.totalPago)} />
                <Numero rotulo="Deve agora" valor={FormatarValor(r.deve)}
                    detalhe={c.limite_fiado ? `limite de ${FormatarValor(c.limite_fiado)}` : null} />
            </dl>

            <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-slate-700">Últimos 12 meses</h3>
                    <p className="flex gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-marca-700" />comprou</span>
                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />pagou</span>
                    </p>
                </div>
                <div className="flex items-end gap-1 sm:gap-1.5 h-28 rounded-xl bg-slate-50 ring-1 ring-slate-900/5 px-2 pt-3 pb-1">
                    {meses.map(m => {
                        const [ano, mes] = m.mes.split('-').map(Number)
                        return (
                            <div key={m.mes} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1"
                                title={`${NOMES_MES[mes - 1]}/${ano}: comprou ${FormatarValor(m.comprado)}, pagou ${FormatarValor(m.pago)}`}>
                                <div className="w-full flex-1 flex items-end justify-center gap-px">
                                    <div className="w-1/2 max-w-3 rounded-t bg-marca-700" style={{ height: `${(m.comprado / maiorMes) * 100}%` }} />
                                    <div className="w-1/2 max-w-3 rounded-t bg-emerald-500" style={{ height: `${(m.pago / maiorMes) * 100}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-500">{NOMES_MES[mes - 1]}</span>
                            </div>
                        )
                    })}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Alguns pagamentos antigos ficaram sem data e não aparecem no gráfico (mas contam no total já pago).</p>
            </section>

            {(c.apelido || c.email || c.endereco || aniversario || c.documento || c.whatsapp) && (
                <section>
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Cadastro</h3>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                        {[
                            ['Apelido', c.apelido],
                            ['WhatsApp', c.whatsapp],
                            ['E-mail', c.email],
                            ['CPF/CNPJ', c.documento],
                            ['Aniversário', aniversario],
                            ['Endereço', c.endereco],
                        ].filter(([, v]) => v).map(([k, v]) => (
                            <div key={k} className="flex gap-2 min-w-0">
                                <dt className="text-slate-500 shrink-0">{k}:</dt>
                                <dd className="text-slate-800 truncate">{v}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}
            <p className="text-xs text-slate-400">Pra mudar o cadastro: Editar clientes, na tela principal.</p>
        </div>
    )
}
