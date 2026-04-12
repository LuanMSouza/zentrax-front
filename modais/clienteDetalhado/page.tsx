'use client'
import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Titulo from "@/componentes/Titulo";
import Swal from "sweetalert2";
import { CobrarBack, pagamentoAvulso, pagamentoEspecifico } from "./actions";

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
    notas: any[]
    sair: () => void; // Dica: adicione uma função para fechar o modal
    atualizar: (notasAbatidas: any[]) => void; // <--- Adicione aqui
}

export default function ClienteDetalhado({ cliente, sair, notas, atualizar }: DetalhadoPops) {
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

    function formatarData(isoString: string) {
        const date = new Date(isoString);
        const dia = String(date.getDate() + 1).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0'); // meses começam do 0
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    function lancarPagamento(id: Number) {

        Swal.fire({
            title: `Valor recebido de ${cliente.nome}`,
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

                    atualizar(res.notaAtualizada);

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

                        atualizar([res.notaAtualizada] as any);

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
                        atualizar([res.notaAtualizada] as any);

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

        console.log(res);


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

                <div className="grid  md:grid-cols-4 sm:grid-cols-2 w-8/9 p-4 items-center justify-center gap-1 md:gap-4">

                    <div className="bg-cyan-100  p-2 w-full border-3 rounded-2xl flex flex-col justify-center items-center border-cyan-400 shadow shadow-cyan-700">
                        <p className=" md:text-xl">Total em aberto:</p>
                        <p className="md:text-2xl text-xl font-bold">{formatarValor(String(totalAtualizado))}</p>
                    </div>

                    <Button maxw="full" onClick={() => lancarPagamento(cliente.id)} texto="Pagamento" tipo="btn03" tamanho="g" corTexto="branco" />
                    <Button maxw="full" onClick={() => cobrar(cliente.id)} texto="Cobrar Cliente" tipo="btn03" tamanho="g" corTexto="branco" />

                    <div className="bg-cyan-100  p-2 w-full border-3 rounded-2xl flex flex-col justify-center items-center border-cyan-400 shadow shadow-cyan-700">
                        <p className=" md:text-xl">Notas em aberto:</p>
                        <p className="text-2xl font-bold">{quantidadeNotasAtivas}</p>
                    </div>

                </div>

                <div className=" cursor-default flex flex-col w-full gap-2 max-h-80 overflow-y-auto">
                    {notas.map((n) => {

                        let taPago = Number(n.valor_inicial) - Number(n.valor_abatido) === 0

                        const opacidades = {
                            pago: 'opacity-50',
                            aberto: 'opacity-100'
                        }


                        return (
                            <div
                                key={n.id}
                                className={` ${taPago ? opacidades.pago : opacidades.aberto} border border-gray-400 p-2 px-7 rounded-2xl shadow shadow-cyan-500 
                            justify-between flex`}>

                                {/* esquerda */}
                                {segmento === 'geral' &&
                                    <div className=" flex flex-col justify-center">
                                        <p className="text-xl font-bold">{formatarValor(String(n.valor_inicial - n.valor_abatido))}</p>
                                        <p className=" italic text-gray-800">{n.descricao}</p>
                                        <p className="text-gray-600">{formatarData(n.data)}</p>
                                        {(Number(n.valor_abatido) > 0) && (
                                            <div className="italic text-sm text-gray-500">
                                                <hr className="border-gray-300 my-1" />
                                                <p>Valor inicial: {formatarValor(n.valor_inicial)}</p>
                                                <p>Já abatido: {formatarValor(n.valor_abatido)}</p>
                                            </div>
                                        )}

                                    </div>
                                }

                                {segmento === 'pet' &&
                                    <div className=" flex flex-col justify-center">
                                        <p className="text-xl font-bold">{formatarValor(String(n.valor_inicial - n.valor_abatido))}</p>
                                        <p className="  text-gray-800">🐶 Pet : {n.descricao ?? 'Não informado'}</p>
                                        <p className="  text-gray-800">📃 {n.quantidade} (diarias) : x {formatarValor(n.valor_unitario)}</p>
                                        <p className=" italic text-gray-800">⭐ Extras : {formatarValor(n.valor_extra) ?? formatarValor('0')}</p>
                                        <p className="text-gray-600">{formatarData(n.data)}</p>


                                        {(Number(n.valor_abatido) > 0 && Number(n.valor_abatido) < Number(n.valor_inicial)) && (
                                            <div className="italic text-sm text-gray-500">
                                                <hr className="border-gray-300 my-1" />
                                                <p>Valor inicial: {formatarValor(n.valor_inicial)}</p>
                                                <p>Já abatido: {formatarValor(n.valor_abatido)}</p>
                                            </div>
                                        )}

                                    </div>
                                }

                                {/* direita */}
                                {n.valor_inicial != n.valor_abatido && (
                                    <div className=" flex  justify-center flex-col w-fit gap-1">
                                        <Button maxw="full" onClick={() => lancarPagEspecifico('total', n.id, Number(n.valor_inicial - n.valor_abatido))} texto="Registrar pagamento total" tipo="btn04" tamanho="m" corTexto="branco" />
                                        <Button maxw="full" onClick={() => lancarPagEspecifico('parcial', n.id, Number(n.valor))} texto="Registrar pagamento parcial" tipo="btn05" tamanho="m" corTexto="branco" />
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