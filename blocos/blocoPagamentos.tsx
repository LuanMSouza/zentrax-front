'use client'

import { useState } from "react";

import { Pagamentos } from "@/types";
import { formatarDataBR } from "@/lib/mask";
import { DadosComprovante, oferecerComprovante } from "@/lib/comprovante";
import { nomeForma } from "@/lib/formas";
import { pegarNotasDoClienteBack } from "@/app/dashboard/actions";
import { desfazerPagamentoBack } from "@/modais/clienteDetalhado/actions";
import Swal from "sweetalert2";

type PagamentoProps = {
    pagamentos: Pagamentos[],
    MostrarValor: boolean,
    temMaisNoServidor: boolean,
    carregandoMais: boolean,
    carregarMais: () => void,
    role?: string | null,
    aposDesfazer?: () => void
}

export default function BlocoPagamentos({ pagamentos, MostrarValor, temMaisNoServidor, carregandoMais, carregarMais, role, aposDesfazer }: PagamentoProps) {


    const [mostrando, setMostrando] = useState(4);
    const lista = pagamentos?.length;

    function formatarValor(valor: number) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    async function reimprimir(p: Pagamentos) {
        const base = { cliente: p.clientes?.nome ?? '', reimpressao: true };
        let dados: DadosComprovante;

        if (p.recibo) {
            dados = {
                ...base,
                valor: p.recibo.valor,
                numero: p.recibo.numero,
                forma: p.recibo.forma,
                atendente: p.recibo.atendente,
                dataHora: p.recibo.criadoEm,
                saldo: p.recibo.saldoApos
            };
        } else {
            // Pagamento de antes do recibo numerado: só existe o dia e o valor. O saldo que dá pra mostrar é o de
            // hoje (mesma regra do card: só nota com saldo > 0); se a busca falhar, sai sem a linha de saldo em
            // vez de sair com um número errado.
            let saldo: number | undefined;
            try {
                const res = await pegarNotasDoClienteBack(p.id_cliente);
                if (res.success && res.data) {
                    saldo = (res.data as { valor_inicial: number, valor_abatido: number }[]).reduce((acc, n) => {
                        const aberto = Number(n.valor_inicial) - Number(n.valor_abatido);
                        return aberto > 0 ? acc + aberto : acc;
                    }, 0);
                }
            } catch (error) {
                console.error("Erro ao buscar saldo pra reimpressão:", error);
            }
            dados = { ...base, valor: p.valor, dia: p.data, saldo, saldoDeHoje: true };
        }

        await oferecerComprovante({
            titulo: 'Reimprimir comprovante',
            texto: p.clientes?.nome,
            whatsapp: p.clientes?.whatsapp ? String(p.clientes.whatsapp) : null,
            dados
        });
    }

    // Pagamento lançado errado: devolve o valor pras notas. Só gestor, com a senha (o servidor confere as duas coisas).
    async function desfazer(p: Pagamentos) {
        if (!p.recibo) return;
        const { value: senha, isConfirmed } = await Swal.fire({
            titleText: `Desfazer o pagamento de ${formatarValor(p.recibo.valor)}?`,
            text: `${p.clientes?.nome ?? 'Cliente'}, recibo nº ${String(p.recibo.numero).padStart(6, '0')}. O valor volta pras notas que ele abateu e o recibo fica marcado como desfeito. Digite sua senha pra confirmar.`,
            icon: 'warning',
            input: 'password',
            inputAttributes: { autocomplete: 'current-password', 'aria-label': 'Sua senha' },
            inputPlaceholder: 'Sua senha',
            showCancelButton: true,
            confirmButtonText: 'Desfazer pagamento',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Cancelar',
            inputValidator: (v) => (!v ? 'Digite sua senha' : null),
        });
        if (!isConfirmed) return;

        const res = await desfazerPagamentoBack(p.recibo.numero, String(senha));
        if (!res.success) {
            Swal.fire('Opa...', res.error, 'error');
            return;
        }
        Swal.fire('Pronto!', 'Pagamento desfeito. O valor voltou pras notas do cliente.', 'success');
        aposDesfazer?.();
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
                                        {p.recibo && ` · ${nomeForma(p.recibo.forma)}`}
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
                                    {role === 'gestor' && p.recibo && (
                                        <button
                                            onClick={() => desfazer(p)}
                                            aria-label={`Desfazer pagamento de ${p.clientes?.nome ?? 'cliente'}`}
                                            title="Desfazer pagamento"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
                                        </button>
                                    )}
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
