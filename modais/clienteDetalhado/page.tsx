'use client'
import { useEffect, useState } from "react";
import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Titulo from "@/componentes/Titulo";
import Swal from "sweetalert2";
import { CobrarBack, pagamentoAvulso, pagamentoEspecifico, combinarVencimento, resumoDoClienteBack, linkDoExtratoBack, configJurosBack } from "./actions";
import { ConfigJuros, JUROS_DESLIGADO, jurosDaNota, hojeISOBR } from "@/lib/juros";
import Resumo, { DadosResumo } from "./Resumo";
import { pegarNotasDoClienteBack } from "@/app/dashboard/actions";
import { formatarDataBR, linkWhatsApp, diasAteVencer } from "@/lib/mask";
import { imprimirExtrato, oferecerComprovante } from "@/lib/comprovante";
import { FORMAS } from "@/lib/formas";
import { Recibo } from "@/types";

// Só id e nome são usados: a ficha também abre pelos Relatórios, pra cliente que não deve nada.
type ClienteDaFicha = {
    id: number;
    nome: string;
}

type DetalhadoPops = {
    cliente: ClienteDaFicha;
    sair: () => void;
    atualizarClientes: () => void; // refaz o agregado (total/quantidade) na tela principal
    atualizarPagamentos: () => void;
}

export default function ClienteDetalhado({ cliente, sair, atualizarClientes, atualizarPagamentos }: DetalhadoPops) {
    const [notas, setNotas] = useState<any[]>([]);
    const [carregandoNotas, setCarregandoNotas] = useState(true);
    const [aba, setAba] = useState<'notas' | 'resumo'>('notas');
    const [resumo, setResumo] = useState<DadosResumo | null>(null);
    const [erroResumo, setErroResumo] = useState<string | null>(null);
    const [configJuros, setConfigJuros] = useState<ConfigJuros>(JUROS_DESLIGADO);

    async function recarregarResumo() {
        try {
            const res = await resumoDoClienteBack(cliente.id);
            if (res.success) {
                setResumo(res);
                setErroResumo(null);
            } else setErroResumo(res.error);
        } catch (error) {
            console.error("Erro ao buscar resumo do cliente:", error);
            setErroResumo('Não deu pra carregar o resumo agora.');
        }
    }

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
        recarregarResumo(); // junto: as observações do cadastro aparecem já na aba Notas
        configJurosBack().then(setConfigJuros).catch(() => {});
    }, [cliente.id]);

    async function remarcar(nota: { id: number, data: string, vencimento: string | null }) {
        const { value, isConfirmed, isDenied } = await Swal.fire({
            title: nota.vencimento ? 'Remarcar pagamento' : 'Combinar data',
            text: 'Quando o cliente combinou de pagar essa nota?',
            input: 'date',
            inputValue: nota.vencimento ? String(nota.vencimento).slice(0, 10) : '',
            inputAttributes: { min: String(nota.data).slice(0, 10) },
            showCancelButton: true,
            showDenyButton: !!nota.vencimento,
            confirmButtonText: 'Salvar',
            denyButtonText: 'Tirar data',
            cancelButtonText: 'Cancelar',
            inputValidator: (v) => (!v ? 'Escolhe uma data' : null)
        })
        if (!isConfirmed && !isDenied) return

        const res = await combinarVencimento(nota.id, isDenied ? null : value)
        if (!res.success) {
            Swal.fire('Opa...', res.error, 'error')
            return
        }
        recarregarNotas()
        recarregarResumo()
        atualizarClientes() // etiqueta e resumo do topo dependem da data
    }

    if (!cliente) return null;

    // Soma e contagem usam a MESMA regra (saldo > 0): uma nota com saldo negativo (pago a mais que o valor — sempre
    // um erro de lançamento, nunca deveria acontecer) antes entrava na soma do total mas ficava de fora da
    // contagem, deixando os dois números do próprio card inconsistentes entre si.
    const totalAtualizado = notas.reduce((acc, n) => {
        const saldo = Number(n.valor_inicial) - Number(n.valor_abatido);
        return saldo > 0 ? acc + saldo : acc;
    }, 0);

    // juros por atraso (só se a loja ligou em Preferências): informativo, não muda o saldo da nota
    const hoje = hojeISOBR();
    const jurosPorNota = new Map<number, { dias: number, valor: number }>(
        notas.map(n => [n.id, jurosDaNota(Number(n.valor_inicial) - Number(n.valor_abatido), n, configJuros, hoje)]));
    const totalJuros = [...jurosPorNota.values()].reduce((acc, j) => acc + j.valor, 0);

    const quantidadeNotasAtivas = notas.filter(n =>
        (Number(n.valor_inicial) - Number(n.valor_abatido)) > 0
    ).length;

    // Nunca deveria existir — sinaliza em vez de esconder, pra não passar pro Luan um total menor
    // (ou maior) do que o cliente realmente deve sem ele saber que tem uma nota com problema.
    const notasComProblema = notas.filter(n => Number(n.valor_abatido) > Number(n.valor_inicial) + 0.009);

    function formatarValor(valor: string | number) {
        const valorNumerico = Number(valor);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valorNumerico);
    }

    // Depois de qualquer pagamento gravado: atualiza a tela e oferece o comprovante (imprimir e/ou WhatsApp).
    async function pagamentoRegistrado(recibo: Recibo | null | undefined, whatsapp: string | null | undefined) {
        recarregarNotas();
        recarregarResumo();
        atualizarClientes();
        atualizarPagamentos();

        // sem recibo = nada foi pago de fato (a nota já estava quitada), então não tem o que comprovar
        if (!recibo) {
            Swal.fire('Sucesso!', 'Pagamento registrado com sucesso.', 'success');
            return;
        }

        await oferecerComprovante({
            titulo: 'Sucesso!',
            texto: 'Pagamento registrado com sucesso.',
            sucesso: true,
            whatsapp,
            dados: {
                cliente: cliente.nome,
                valor: recibo.valor,
                numero: recibo.numero,
                forma: recibo.forma,
                atendente: recibo.atendente,
                dataHora: recibo.criadoEm,
                saldo: recibo.saldoApos
            }
        });
    }

    function extrato() {
        imprimirExtrato({
            cliente: cliente.nome,
            clienteDesde: resumo?.resumo.clienteDesde ?? null,
            notas: notas.map(n => ({
                data: n.data,
                descricao: n.descricao,
                valorInicial: Number(n.valor_inicial),
                valorAbatido: Number(n.valor_abatido)
            }))
        });
    }

    // Pergunta a forma de pagamento e, se `pedirValor`, quanto foi pago. Devolve null se a pessoa cancelou.
    // A forma já vem na última usada neste navegador, que costuma ser a mais comum da loja.
    async function perguntarPagamento({ titulo, texto, pedirValor }: { titulo: string, texto?: string, pedirValor: boolean }) {
        const ultimaForma = localStorage.getItem('ultimaForma');
        const campo = 'width:100%;margin:6px 0 0;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px;';
        const rotulo = 'display:block;text-align:left;font-size:14px;margin-top:14px;';

        const result = await Swal.fire({
            titleText: titulo, // titleText: o `title` do SweetAlert é HTML e o nome do cliente vem do usuário
            html: `
                ${texto ? `<p id="pag-texto"></p>` : ''}
                ${pedirValor ? `<label style="${rotulo}">Valor recebido
                    <input id="pag-valor" type="number" step="0.01" min="0" inputmode="decimal" placeholder="ex.: 50.00" style="${campo}">
                </label>` : ''}
                <label style="${rotulo}">Forma de pagamento
                    <select id="pag-forma" style="${campo}background:#fff;">
                        ${Object.entries(FORMAS).map(([chave, nome]) =>
                            `<option value="${chave}" ${chave === ultimaForma ? 'selected' : ''}>${nome}</option>`).join('')}
                    </select>
                </label>`,
            didOpen: () => {
                const p = document.getElementById('pag-texto');
                if (p && texto) p.textContent = texto;
                document.getElementById('pag-valor')?.focus();
            },
            confirmButtonText: pedirValor ? 'Continuar' : 'Sim, pagar!',
            confirmButtonColor: '#3C32E6',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            cancelButtonColor: '#E62618',
            preConfirm: () => {
                const forma = (document.getElementById('pag-forma') as HTMLSelectElement).value;
                if (!pedirValor) return { forma, valor: 0 };

                const valor = Number((document.getElementById('pag-valor') as HTMLInputElement).value);
                if (!Number.isFinite(valor) || valor <= 0) {
                    Swal.showValidationMessage('Informe um valor maior que R$ 0,00 para abater');
                    return false;
                }
                return { forma, valor };
            }
        });

        if (!result.isConfirmed || !result.value) return null;

        const resposta = result.value as { forma: string, valor: number };
        localStorage.setItem('ultimaForma', resposta.forma);
        return resposta;
    }

    async function lancarPagamento() {
        const resposta = await perguntarPagamento({ titulo: `Valor recebido de ${cliente.nome}`, pedirValor: true });
        if (!resposta) return;

        const res = await pagamentoAvulso({ id: cliente.id, valor: resposta.valor, forma: resposta.forma });

        if (res.success && res.notaAtualizada) {
            pagamentoRegistrado(res.recibo, res.whatsapp);
        } else {
            Swal.fire('Erro no servidor', res.error, 'error');
        }
    }

    async function lancarPagEspecifico(tipo: 'parcial' | 'total', id: number, saldoDaNota: number) {
        const resposta = tipo === 'parcial'
            ? await perguntarPagamento({ titulo: 'Valor parcial', texto: `Quanto o cliente ${cliente.nome} pagou?`, pedirValor: true })
            : await perguntarPagamento({ titulo: 'Deseja registrar o pagamento total?', texto: `O valor restante dessa nota é de ${formatarValor(saldoDaNota)}`, pedirValor: false });
        if (!resposta) return;

        const res = await pagamentoEspecifico({
            tipo,
            id,
            valor: tipo === 'parcial' ? resposta.valor : saldoDaNota,
            forma: resposta.forma
        });

        if (res?.success && res.notaAtualizada) {
            pagamentoRegistrado(res.recibo, res.whatsapp);
        } else {
            Swal.fire('Opa!!', res?.error, 'error');
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
                    window.open(linkWhatsApp(res.whatsapp ?? '', res.mensagem), '_blank');
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

    // Link pro cliente ver as notas dele no celular (vale 30 dias)
    async function mandarExtrato() {
        const res = await linkDoExtratoBack(cliente.id);
        if (!res.success) {
            Swal.fire('Opa...', res.error, 'error');
            return;
        }
        const primeiroNome = res.nome.trim().split(/\s+/)[0];
        const mensagem = `Oi, ${primeiroNome}! Segue o link com suas notas${res.loja ? ` aqui da ${res.loja}` : ''}: ${res.url}`;

        const escolha = await Swal.fire({
            title: 'Link do extrato pronto',
            text: 'O cliente abre no celular e vê as notas em aberto e os últimos pagamentos. O link vale 30 dias.',
            icon: 'success',
            showCancelButton: true,
            confirmButtonColor: '#25D366',
            cancelButtonColor: '#3085d6',
            confirmButtonText: res.whatsapp ? 'Mandar no WhatsApp' : 'Copiar mensagem',
            cancelButtonText: res.whatsapp ? 'Só copiar' : 'Fechar',
        });
        if (escolha.isConfirmed && res.whatsapp) {
            window.open(linkWhatsApp(res.whatsapp, mensagem), '_blank');
        } else if (escolha.isConfirmed || (res.whatsapp && escolha.dismiss === Swal.DismissReason.cancel)) {
            await navigator.clipboard.writeText(mensagem);
            Swal.fire('Copiado!', 'A mensagem com o link foi copiada.', 'success');
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

                {resumo?.cadastro.bloqueado && (
                    <p className="rounded-xl bg-red-50 ring-1 ring-red-600/20 px-4 py-2.5 text-sm font-medium text-red-700">
                        Fiado bloqueado pra esse cliente.
                    </p>
                )}
                {resumo?.cadastro.observacoes && (
                    <p className="rounded-xl bg-slate-50 ring-1 ring-slate-900/10 px-4 py-2.5 text-sm text-slate-700 whitespace-pre-line">
                        <span className="font-medium">Obs.:</span> {resumo.cadastro.observacoes}
                    </p>
                )}

                <div className="flex gap-1 p-1 bg-slate-200/60 rounded-xl w-fit" role="tablist">
                    {(['notas', 'resumo'] as const).map(a => (
                        <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${aba === a ? 'bg-marca-950 text-white' : 'text-slate-600 hover:bg-slate-200/70'}`}>
                            {a === 'notas' ? 'Notas' : 'Resumo'}
                        </button>
                    ))}
                </div>

                {aba === 'resumo' && (
                    resumo ? <Resumo dados={resumo} />
                        : <p className="text-center text-sm text-slate-500 py-6">{erroResumo ?? 'Carregando resumo...'}</p>
                )}

                {aba === 'notas' && <>
                <dl className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-marca-950 text-white px-4 py-3">
                        <dt className="text-xs text-slate-300">Total em aberto</dt>
                        <dd className="mt-0.5 text-xl sm:text-2xl font-semibold tabular-nums">{formatarValor(String(totalAtualizado))}</dd>
                        {totalJuros > 0 && <dd className="text-xs text-amber-300 mt-0.5">com juros: {formatarValor(totalAtualizado + totalJuros)}</dd>}
                    </div>
                    <div className="rounded-xl bg-slate-100 px-4 py-3">
                        <dt className="text-xs text-slate-500">Notas em aberto</dt>
                        <dd className="mt-0.5 text-xl sm:text-2xl font-semibold tabular-nums text-slate-900">{quantidadeNotasAtivas}</dd>
                    </div>
                </dl>

                {notasComProblema.length > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">⚠ {notasComProblema.length === 1 ? 'Uma nota está' : `${notasComProblema.length} notas estão`} com pagamento maior que o valor da nota.</p>
                        <p className="mt-1">Não entra no total nem na contagem acima. Provavelmente um lançamento duplicado ou um crédito a favor do cliente. Confira com calma antes de falar o total com ele:</p>
                        <ul className="mt-1.5 list-disc list-inside">
                            {notasComProblema.map(n => (
                                <li key={n.id}>{formatarDataBR(n.data)} · nota de {formatarValor(n.valor_inicial)}, pago {formatarValor(n.valor_abatido)} (excesso de {formatarValor(Number(n.valor_abatido) - Number(n.valor_inicial))})</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 2 por linha no celular, 4 numa linha só no computador: sem botão sobrando sozinho embaixo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button onClick={lancarPagamento} className="px-2 sm:px-3 py-2.5 rounded-lg text-[13px] sm:text-sm whitespace-nowrap font-medium bg-marca-700 hover:bg-marca-800 text-white active:scale-[0.98] transition-all cursor-pointer">
                        Registrar pagamento
                    </button>
                    {[
                        { texto: 'Cobrar no WhatsApp', acao: () => cobrar(cliente.id) },
                        { texto: 'Mandar extrato', acao: mandarExtrato },
                        { texto: 'Imprimir notas', acao: extrato, desligado: carregandoNotas },
                    ].map(b => (
                        <button key={b.texto} onClick={b.acao} disabled={b.desligado}
                            className="px-2 sm:px-3 py-2.5 rounded-lg text-[13px] sm:text-sm whitespace-nowrap font-medium bg-white ring-1 ring-slate-900/10 hover:ring-marca-700/40 text-slate-700 active:scale-[0.98] disabled:opacity-60 transition-all cursor-pointer">
                            {b.texto}
                        </button>
                    ))}
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
                                        <p className="text-xs text-slate-500">{formatarDataBR(n.data)}{!taPago && <DataCombinada vencimento={n.vencimento} />}</p>
                                        {!taPago && (jurosPorNota.get(n.id)?.valor ?? 0) > 0 && (
                                            <p className="text-xs font-medium text-amber-700">+ {formatarValor(jurosPorNota.get(n.id)!.valor)} de juros ({jurosPorNota.get(n.id)!.dias} dias de atraso)</p>
                                        )}
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
                                        <p className="text-xs text-slate-500">{formatarDataBR(n.data)}{!taPago && <DataCombinada vencimento={n.vencimento} />}</p>
                                        {!taPago && (jurosPorNota.get(n.id)?.valor ?? 0) > 0 && (
                                            <p className="text-xs font-medium text-amber-700">+ {formatarValor(jurosPorNota.get(n.id)!.valor)} de juros ({jurosPorNota.get(n.id)!.dias} dias de atraso)</p>
                                        )}

                                        {(Number(n.valor_abatido) > 0 && Number(n.valor_abatido) < Number(n.valor_inicial)) && (
                                            <p className="mt-1 text-xs text-slate-500">
                                                Valor inicial {formatarValor(n.valor_inicial)} · já abatido {formatarValor(n.valor_abatido)}
                                            </p>
                                        )}
                                    </div>
                                }

                                {/* direita: parcial não é ação de perigo, então deixou de ser vermelho */}
                                {n.valor_inicial != n.valor_abatido && (
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                        <Button onClick={() => lancarPagEspecifico('total', n.id, Number(n.valor_inicial - n.valor_abatido))} texto="Pagou tudo" tipo="btn04" tamanho="m" corTexto="branco" />
                                        <button
                                            onClick={() => lancarPagEspecifico('parcial', n.id, Number(n.valor_inicial - n.valor_abatido))}
                                            className="px-3 py-1.5 rounded-lg text-sm md:text-base font-medium bg-white ring-1 ring-slate-900/10 hover:ring-marca-700/40 text-slate-700 active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            Pagou parte
                                        </button>
                                        <button
                                            onClick={() => remarcar(n)}
                                            className="px-3 py-1.5 rounded-lg text-sm md:text-base font-medium bg-white ring-1 ring-slate-900/10 hover:ring-marca-700/40 text-slate-700 active:scale-[0.98] transition-all cursor-pointer"
                                        >
                                            {n.vencimento ? 'Remarcar' : 'Combinar data'}
                                        </button>
                                    </div>
                                )}

                            </div>
                        )
                    })}
                </div>
                </>}
            </Container>
        </Cortina >
    )
}

// "· vence 10/11" ao lado da data da venda; vermelho quando já passou, âmbar quando é hoje.
function DataCombinada({ vencimento }: { vencimento: string | Date | null | undefined }) {
    const d = diasAteVencer(vencimento)
    if (d === null) return null
    const cls = d < 0 ? 'text-red-700 font-medium' : d === 0 ? 'text-amber-700 font-medium' : ''
    const texto = d < 0 ? `venceu ${formatarDataBR(vencimento).slice(0, 5)}` : d === 0 ? 'vence hoje' : `vence ${formatarDataBR(vencimento).slice(0, 5)}`
    return <span className={cls}> · {texto}</span>
}
