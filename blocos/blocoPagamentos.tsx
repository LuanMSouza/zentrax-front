'use client'

import { useState } from "react";

import { Pagamentos } from "@/types";
import { formatarDataBR } from "@/lib/mask";
import { imprimirComprovante, perguntarVias } from "@/lib/comprovante";
import { pegarNotasDoClienteBack } from "@/app/dashboard/actions";

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

    // Sem atendente: o pagamento não guarda quem registrou, e quem está reimprimindo pode ser outra pessoa.
    async function reimprimir(p: Pagamentos) {
        const vias = await perguntarVias({ titulo: 'Reimprimir comprovante', texto: p.clientes?.nome });
        if (!vias) return;

        // saldo de hoje do cliente (mesma regra do card: só nota com saldo > 0); se a busca falhar, o
        // comprovante sai sem a linha de saldo em vez de sair com um número errado
        let saldoRestante: number | undefined;
        try {
            const res = await pegarNotasDoClienteBack(p.id_cliente);
            if (res.success && res.data) {
                saldoRestante = (res.data as { valor_inicial: number, valor_abatido: number }[]).reduce((acc, n) => {
                    const saldo = Number(n.valor_inicial) - Number(n.valor_abatido);
                    return saldo > 0 ? acc + saldo : acc;
                }, 0);
            }
        } catch (error) {
            console.error("Erro ao buscar saldo pra reimpressão:", error);
        }

        const empresa = JSON.parse(localStorage.getItem('empresa') ?? '{}');
        imprimirComprovante({
            empresa: empresa?.nome ?? '',
            cliente: p.clientes?.nome ?? '',
            valor: p.valor,
            vias,
            saldoRestante,
            reimpressaoDe: p.data
        });
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
                                <div className="flex items-center gap-2 shrink-0">
                                    <p className="font-semibold text-emerald-700 tabular-nums">{formatarValor(p.valor)}</p>
                                    <button
                                        onClick={() => reimprimir(p)}
                                        aria-label={`Reimprimir comprovante de ${p.clientes?.nome ?? 'cliente'}`}
                                        title="Reimprimir comprovante"
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-marca-700 hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></svg>
                                    </button>
                                </div>
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
