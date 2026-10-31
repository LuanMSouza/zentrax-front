'use client'

import { ClienteEmAberto } from '@/types'
import { formatarDataBR, diasDesde, diasAteVencer } from '@/lib/mask'
import { seloPagador } from '@/lib/cliente'

type BlocoProps = {
    clientes: ClienteEmAberto[],
    onClick: (e: ClienteEmAberto) => void,
    valor: boolean
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Faixas de atraso (idade da nota mais antiga em aberto). Antes as datas
// vinham em vermelho/verde/azul sem legenda; agora o "há X dias" diz o que
// importa e só ganha cor quando passa de 30 dias.
function faixa(dias: number | null) {
    if (dias === null) return null
    if (dias >= 60) return { rotulo: `há ${dias} dias`, cls: 'bg-red-50 text-red-700 ring-red-600/20' }
    if (dias >= 30) return { rotulo: `há ${dias} dias`, cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
    return { rotulo: dias === 0 ? 'hoje' : `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`, cls: 'bg-slate-100 text-slate-600 ring-slate-500/10' }
}

// Quando alguma nota tem dia combinado, a etiqueta fala do vencimento (o que importa pra cobrar); sem dia
// combinado continua a idade da nota mais antiga.
function etiquetaVencimento(c: ClienteEmAberto) {
    const d = diasAteVencer(c.proximo_vencimento)
    if (d === null) return null
    if (d < 0) return { rotulo: `atrasado ${-d} ${d === -1 ? 'dia' : 'dias'}`, cls: 'bg-red-50 text-red-700 ring-red-600/20' }
    if (d === 0) return { rotulo: 'vence hoje', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
    if (d === 1) return { rotulo: 'vence amanhã', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
    return { rotulo: `vence ${formatarDataBR(c.proximo_vencimento).slice(0, 5)}`, cls: 'bg-slate-100 text-slate-600 ring-slate-500/10' }
}

export function BlocoClientes({ clientes, onClick, valor }: BlocoProps) {
    return (
        // lista compacta: no celular 1 coluna de linhas (cabem ~8 por tela em vez
        // de 2), no desktop 2–3 colunas
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {clientes.map(c => {
                const dias = diasDesde(c.mais_antiga)
                const f = etiquetaVencimento(c) ?? faixa(dias)
                const selo = seloPagador(c.media_dias_quitar, c.notas_quitadas)
                return (
                    <li key={c.id}>
                        <button
                            onClick={() => onClick(c)}
                            className="w-full text-left bg-white rounded-xl ring-1 ring-slate-900/5 hover:ring-marca-700/40 hover:shadow-sm active:scale-[0.99] transition-all px-4 py-3 flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-marca-700"
                        >
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{c.nome}{c.apelido && <span className="font-normal text-slate-500"> ({c.apelido})</span>}</p>
                                <p className="mt-0.5 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span>{valor ? c.quantidade_de_notas : '•'} {c.quantidade_de_notas === 1 ? 'nota' : 'notas'}</span>
                                    {c.bloqueado && <span className="inline-flex px-2 py-0.5 rounded-full ring-1 ring-inset font-medium bg-red-50 text-red-700 ring-red-600/20">fiado bloqueado</span>}
                                    {f && <span className={`inline-flex px-2 py-0.5 rounded-full ring-1 ring-inset font-medium ${f.cls}`}>{f.rotulo}</span>}
                                    {selo && (
                                        <span title={`Em média ${Math.round(c.media_dias_quitar!)} dias pra quitar (últimas ${c.notas_quitadas} notas)`}
                                            className={`inline-flex px-2 py-0.5 rounded-full ring-1 ring-inset ${selo.cls}`}>{selo.rotulo}</span>
                                    )}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-semibold text-slate-900 tabular-nums">{valor ? moeda.format(Number(c.total)) : 'R$ ••••'}</p>
                                <p className="text-[11px] text-slate-400 tabular-nums">desde {formatarDataBR(c.mais_antiga)}</p>
                            </div>
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}
