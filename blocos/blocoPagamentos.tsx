'use client'

import { useState } from "react";

import { Pagamentos } from "@/types";
import { formatarDataBR } from "@/lib/mask";

type PagamentoProps = {
    pagamentos: Pagamentos[],
    MostrarValor: boolean,
    temMaisNoServidor: boolean,
    carregandoMais: boolean,
    carregarMais: () => void
}

export default function BlocoPagamentos({ pagamentos, MostrarValor, temMaisNoServidor, carregandoMais, carregarMais }: PagamentoProps) {


    const [mostrando, setMostrando] = useState(4);
    const lista = pagamentos?.length;

    function formatarValor(valor: number) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    function aumentar() {
        if (carregandoMais) return;
        if (mostrando + 4 < lista) {
            setMostrando(mostrando + 4);
        } else if (temMaisNoServidor) {
            // Ja mostrando tudo que veio do servidor - busca a proxima
            // pagina e revela assim que ela chegar.
            setMostrando(mostrando + 4);
            carregarMais();
        } else {
            setMostrando(lista);
        }
    }

    return (
        <>
            {MostrarValor ? (
                <div className="flex flex-col items-center w-full gap-4">
                    <ul className="w-full grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {pagamentos.slice(0, mostrando).map(p => (
                            <li key={p.id} className="bg-white rounded-xl ring-1 ring-slate-900/5 px-4 py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">{p.clientes?.nome}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {formatarDataBR(p.data)}
                                        {(p.quantidade ?? 1) > 1 && ` · ${p.quantidade} notas abatidas`}
                                    </p>
                                </div>
                                <p className="font-semibold text-emerald-700 tabular-nums shrink-0">{formatarValor(p.valor)}</p>
                            </li>
                        ))}
                    </ul>

                    {mostrando >= lista && !temMaisNoServidor ? (
                        <p className="text-sm text-slate-500">Não há mais pagamentos para exibir.</p>
                    ) : (
                        <button
                            onClick={aumentar}
                            disabled={carregandoMais}
                            className="px-5 py-2 rounded-lg bg-white ring-1 ring-slate-900/10 text-sm font-medium text-slate-700 hover:ring-marca-700/40 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer"
                        >
                            {carregandoMais ? 'Carregando...' : 'Ver mais'}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-sm text-slate-500 text-center py-8">Valores ocultos. Use o ícone de olho para mostrar.</p>
            )}
        </>
    );
}
