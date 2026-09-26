'use client'
import { useEffect, useState } from "react";
import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Titulo from "@/componentes/Titulo";
import Swal from "sweetalert2";
import { CobrarBack, pagamentoAvulso, pagamentoEspecifico } from "./actions";
import { pegarNotasDoClienteBack } from "@/app/dashboard/actions";
import { formatarDataBR } from "@/lib/mask";

type ClienteEmAberto = {
    id: number;
    nome: string;
    total: string;
    quantidade_de_notas: number;
    mais_nova: string;
    mais_antiga: string;
}

type DetalhadoPops = {
    cliente: ClienteEmAberto;
    sair: () => void;
    atualizarClientes: () => void; // refaz o agregado (total/quantidade) na tela principal
    atualizarPagamentos: () => void;
}

export default function ClienteDetalhado({ cliente, sair, atualizarClientes, atualizarPagamentos }: DetalhadoPops) {
    const [notas, setNotas] = useState<any[]>([]);
    const [carregandoNotas, setCarregandoNotas] = useState(true);

    async function recarregarNotas() {
        setCarregandoNotas(true);
        try {
            const res = await pegarNotasDoClienteBack(cliente.id);
            if (res.success && res.data) {
                setNotas(res.data);
            }
        } catch (error) {
            console.error("Erro ao buscar notas do cliente:", error);
        } finally {
            setCarregandoNotas(false);
        }
    }

    useEffect(() => {
        recarregarNotas();
    }, [cliente.id]);

    if (!cliente) return null;

    const totalAtualizado = notas.reduce((acc, n) =>
        acc + (Number(n.valor_inicial) - Number(n.valor_abatido)), 0
    );

    const quantidadeNotasAtivas = notas.filter(n =>
        (Number(n.valor_inicial) - Number(n.valor_abatido)) > 0
    ).length;

    function formatarValor(valor: string | number) {
        const valorNumerico = Number(valor);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valorNumerico);
    }

    function lancarPagamento(id: Number) {

        Swal.fire({
            titleText: `Valor recebido de ${cliente.nome}`, // titleText: o `title` do SweetAlert é HTML e o nome do cliente vem do usuário
            input: 'number',
            confirmButtonText: 'Continuar',
            confirmButtonColor: '#3C32E6',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            cancelButtonColor: '#E62618',
            inputPlaceholder: 'ex.: 50.00',
            inputAttributes: {
                step: '0.01'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const valor = result.value

                if (valor == 0) {
                    Swal.fire('Opa...', 'Selecione um valor maior que R$ 0,00 para abater', 'error')
                    return
                }

                if (valor <= 0) {
                    Swal.fire('Opa...', 'Selecione um valor positivo para abater', 'error')
                    return
                }

                const res = await pagamentoAvulso({ id: cliente.id, valor })

                if (res.success && res.notaAtualizada) {
                    Swal.fire('Sucesso!', 'Pagamento registrado com sucesso.', 'success');

                    recarregarNotas();
                    atualizarClientes();
                    atualizarPagamentos();

                } else {
                    Swal.fire('Erro no servidor', res.error, 'error');
                }

            }
        })

    }

    async function lancarPagEspecifico(tipo: string, id: number, valor: string | number) {

        let abater: number
        if (tipo === 'parcial') {
            Swal.fire({
                title: `Valor Parcial`,
                text: `Quanto o cliente ${cliente.nome} pagou?`,
                input: 'number',
                confirmButtonText: 'Continuar',
                confirmButtonColor: '#3C32E6',
                showCancelButton: true,
                cancelButtonText: 'Cancelar',
                cancelButtonColor: '#E62618',
                inputPlaceholder: 'ex.: 50.00',
                inputAttributes: {
                    step: '0.01'
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const abater = Number(result.value)

                    if (abater == 0) {
                        Swal.fire('Opa...', 'Selecione um valor maior que R$ 0,00 para abater', 'error')
                        return
                    }

                    if (abater <= 0) {
                        Swal.fire('Opa...', 'Selecione um valor positivo para abater', 'error')
                        return
                    }

                    const res = await pagamentoEspecifico({ tipo: 'parcial', id, valor: abater })

                    if (res?.success && res.notaAtualizada) {
                        Swal.fire('Sucesso!!', 'Nota lançada com sucesso!!', 'success')

                        recarregarNotas();
                        atualizarClientes();
                        atualizarPagamentos();

                    } else {
                        Swal.fire('Opa!!', res?.error, 'error')
                    }
                }
            })

        } else {
            Swal.fire({
                title: 'Deseja registrar o pagamento total?',
                text: `O valor restante dessa nota é de ${formatarValor(valor)}`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sim, pagar!',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3C32E6'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    abater = Number(valor)
                    const res = await pagamentoEspecifico({ tipo: 'total', id, valor: abater })

                    if (res?.success && res.notaAtualizada) {
                        Swal.fire('Sucesso!!', 'Nota lançada com sucesso!!', 'success')
                        recarregarNotas();
                        atualizarClientes();
                        atualizarPagamentos();

                    } else {
                        Swal.fire('Opa!!', res?.error, 'error')
                    }
                } else if (result.isDismissed) {
                    Swal.fire('Cancelado', '', 'warning')
                }
            })
        }
    }

    async function cobrar(id: number) {
        const res = await CobrarBack(id);

        if (res?.whatsapp && res?.mensagem) {
            Swal.fire({
                title: 'Cobrança Gerada!',
                text: 'Como deseja prosseguir?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#25D366', // Cor do WhatsApp
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Abrir WhatsApp',
                cancelButtonText: 'Apenas Copiar',
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const url = `https://wa.me/${res.whatsapp}?text=${encodeURIComponent(res.mensagem)}`;
                    window.open(url, '_blank');
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                    await navigator.clipboard.writeText(res.mensagem);
                    Swal.fire('Copiado!', 'Mensagem copiada para a área de transferência.', 'success');
                }
            });

        } else if (res?.mensagem) {
            await navigator.clipboard.writeText(res.mensagem);
            Swal.fire({
                title: 'Copiado!',
                text: 'Cliente sem WhatsApp. Mensagem copiada!',
                icon: 'success'
            });
        }
    }

    const empresaRaw = localStorage.getItem('empresa')
    const empresa = JSON.parse(empresaRaw ?? '{}')
    const segmento = empresa?.segmento ?? 'geral'

    return (
        <Cortina onClick={sair}>
            <Container tamanho="mg">
                <Titulo cor="preto" texto={cliente.nome} />
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />

                <dl className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-marca-950 text-white px-4 py-3">
                        <dt className="text-xs text-slate-300">Total em aberto</dt>
                        <dd className="mt-0.5 text-xl sm:text-2xl font-semibold tabular-nums">{formatarValor(String(totalAtualizado))}</dd>
                    </div>
                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                        <dt className="text-xs text-slate-500">Notas em aberto</dt>
                        <dd className="mt-0.5 text-xl sm:text-2xl font-semibold tabular-nums text-slate-900">{quantidadeNotasAtivas}</dd>
                    </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => lancarPagamento(cliente.id)} texto="Registrar pagamento" tipo="btn01" tamanho="g" corTexto="branco" />
                    <button
                        onClick={() => cobrar(cliente.id)}
                        className="px-4 py-2 rounded-lg text-sm md:text-base font-medium bg-white ring-1 ring-slate-900/10 hover:ring-marca-700/40 text-slate-700 active:scale-[0.98] transition-all cursor-pointer"
                    >
                        Cobrar pelo WhatsApp
                    </button>
                </div>

                <div className="cursor-default flex flex-col w-full gap-2 max-h-80 overflow-y-auto">
                    {carregandoNotas && <p className="text-center text-sm text-slate-500">Carregando notas...</p>}
                    {notas.map((n) => {

                        const taPago = Number(n.valor_inicial) - Number(n.valor_abatido) === 0

                        return (
                            <div
                                key={n.id}
                                className={`${taPago ? 'opacity-50' : ''} rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3`}>

                                {/* esquerda */}
                                {segmento === 'geral' &&
                                    <div className="flex flex-col justify-center min-w-0">
                                        <p className="text-lg font-semibold tabular-nums text-slate-900">{formatarValor(String(n.valor_inicial - n.valor_abatido))}</p>
                                        {n.descricao && <p className="text-sm text-slate-700 truncate">{n.descricao}</p>}
                                        <p className="text-xs text-slate-500">{formatarDataBR(n.data)}</p>
                                        {(Number(n.valor_abatido) > 0) && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                Valor inicial {formatarValor(n.valor_inicial)} · já abatido {formatarValor(n.valor_abatido)}
                                            </p>
                                        )}
                                    </div>
                                }

                                {segmento === 'pet' &&
                                    <div className="flex flex-col justify-center min-w-0 text-sm text-slate-700">
                                        <p className="text-lg font-semibold tabular-nums text-slate-900">{formatarValor(String(n.valor_inicial - n.valor_abatido))}</p>
                                        <p>🐶 Pet: {n.descricao ?? 'Não informado'}</p>
                                        <p>📃 {n.quantidade} (diárias) x {formatarValor(n.valor_unitario)}</p>
                                        <p>⭐ Extras: {formatarValor(n.valor_extra) ?? formatarValor('0')}</p>
                                        <p className="text-xs text-slate-500">{formatarDataBR(n.data)}</p>

                                        {(Number(n.valor_abatido) > 0 && Number(n.valor_abatido) < Number(n.valor_inicial)) && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                Valor inicial {formatarValor(n.valor_inicial)} · já abatido {formatarValor(n.valor_abatido)}
                                            </p>
                                        )}
                                    </div>
                                }

                                {/* direita: parcial não é ação de perigo, então deixou de ser vermelho */}
                                {n.valor_inicial != n.valor_abatido && (
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button onClick={() => lancarPagEspecifico('total', n.id, Number(n.valor_inicial - n.valor_abatido))} texto="Pagou tudo" tipo="btn04" tamanho="m" corTexto="branco" />
                                        <button
                                            onClick={() => lancarPagEspecifico('parcial', n.id, Number(n.valor))}
                                            className="px-3 py-1.5 rounded-lg text-sm md:text-base font-medium bg-white ring-1 ring-slate-900/10 hover:ring-marca-700/40 text-slate-700 active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            Pagou parte
                                        </button>
                                    </div>
                                )}

                            </div>
                        )
                    })}
                </div>
            </Container>
        </Cortina >
    )
}