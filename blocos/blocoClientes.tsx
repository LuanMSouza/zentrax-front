'use client'

import { ClienteEmAberto } from '@/types'
import { formatarDataBR, diasDesde } from '@/lib/mask'

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

export function BlocoClientes({ clientes, onClick, valor }: BlocoProps) {
    return (
        // lista compacta: no celular 1 coluna de linhas (cabem ~8 por tela em vez
        // de 2), no desktop 2–3 colunas
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {clientes.map(c => {
                const dias = diasDesde(c.mais_antiga)
                const f = faixa(dias)
                return (
                    <li key={c.id}>
                        <button
                            onClick={() => onClick(c)}
                            className="w-full text-left bg-white rounded-xl ring-1 ring-slate-900/5 hover:ring-marca-700/40 hover:shadow-sm active:scale-[0.99] transition-all px-4 py-3 flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-marca-700"
                        >
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{c.nome}</p>
                                <p className="mt-0.5 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span>{valor ? c.quantidade_de_notas : '•'} {c.quantidade_de_notas === 1 ? 'nota' : 'notas'}</span>
                                    {f && <span className={`inline-flex px-2 py-0.5 rounded-full ring-1 ring-inset font-medium ${f.cls}`}>{f.rotulo}</span>}
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
