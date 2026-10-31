import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Input from "@/componentes/Inputs";
import Label from "@/componentes/Label";
import Selects from "@/componentes/Select";
import Titulo from "@/componentes/Titulo";
import { useState } from "react";
import Swal from "sweetalert2";
import { salvarNota, infoDoClienteNaNota } from "./actions";
import { FormatarValor } from "@/lib/mask";
import Loading from "@/componentes/loading";

// types
import { Cliente, Notas } from '@/types'

type lancarNotas = {
    clientes: Cliente[],
    atualizar: (nota: Notas) => void,
    sair: () => void
}

// soma dias numa data YYYY-MM-DD sem passar por fuso (tudo em UTC, igual ao banco)
function somarDias(dataISO: string, dias: number) {
    const d = new Date(`${dataISO}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + dias)
    return d.toISOString().slice(0, 10)
}

// próxima vez que cai o dia X do mês a partir da data da venda (dia 31 em mês curto vira o último dia do mês)
function proximoDiaDoMes(dataISO: string, dia: number) {
    const base = new Date(`${dataISO}T00:00:00Z`)
    for (let m = 0; m < 2; m++) {
        const ano = base.getUTCFullYear(), mes = base.getUTCMonth() + m
        const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
        const d = new Date(Date.UTC(ano, mes, Math.min(dia, ultimo)))
        if (d >= base) return d.toISOString().slice(0, 10)
    }
    return dataISO
}

export default function ModalLançarNotas({ sair, clientes, atualizar }: lancarNotas) {

    const [cliente, setCliete] = useState('')
    const [loading, setLoading] = useState(false)

    const empresaRaw = localStorage.getItem('empresa');
    const empresa = empresaRaw ? JSON.parse(empresaRaw) : '';
    const segmento = empresa?.segmento;

    async function enviar(e: React.FormEvent) {
        e.preventDefault();

        const formData = new FormData(e.currentTarget as HTMLFormElement);

        const limpar = (v: any) => {
            if (!v) return 0;
            return Number(String(v).replace(',', '.'));
        };

        const data = formData.get('data');
        const quantidade = limpar(formData.get('quantidade')) || 1;
        const valorUnitario = limpar(formData.get('valor'));
        const extra = limpar(formData.get('extra'));
        const descricao = formData.get('descricao') ?? null;
        const vencimento = formData.get('vencimento') || null;

        let valorTotal;

        if (segmento === 'pet') {
            valorTotal = (quantidade * valorUnitario) + extra;
        } else {
            valorTotal = valorUnitario + extra;
        }
        if (!cliente) {
            Swal.fire('Opa...', 'Informar o cliente é obrigatório!', 'warning');
            return;
        }
        if (!data) {
            Swal.fire('Opa...', 'Informar a data é obrigatório!', 'warning');
            return;
        }
        if (vencimento && String(vencimento) < String(data)) {
            Swal.fire('Opa...', 'A data combinada pra pagar não pode ser antes da data da venda.', 'warning');
            return;
        }
        // cliente bloqueado pra fiado: aviso forte, mas quem está no balcão ainda decide
        if (info?.bloqueado) {
            const { isConfirmed } = await Swal.fire({
                title: 'Fiado bloqueado',
                text: 'Esse cliente está marcado pra não vender mais fiado. Quer lançar a nota mesmo assim?',
                icon: 'error',
                showCancelButton: true,
                confirmButtonText: 'Lançar mesmo assim',
                cancelButtonText: 'Voltar',
                confirmButtonColor: '#dc2626',
                focusCancel: true
            });
            if (!isConfirmed) return;
        }
        // limite de fiado é só aviso: a loja decide se vende mesmo assim
        if (info?.limite && valorTotal > 0 && info.deve + valorTotal > info.limite) {
            const { isConfirmed } = await Swal.fire({
                title: 'Passa do limite de fiado',
                text: `Com essa nota o cliente fica devendo ${FormatarValor(info.deve + valorTotal)}. O limite dele é ${FormatarValor(info.limite)}.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Lançar mesmo assim',
                cancelButtonText: 'Voltar',
                confirmButtonColor: '#3C32E6'
            });
            if (!isConfirmed) return;
        }

        setLoading(true)

        try {
            const dadosParaEnviar = {
                cliente,
                data,
                valor: valorUnitario,
                valor_total: valorTotal,
                descricao,
                exta: extra,
                segmento,
                quantidade,
                vencimento
            };

            const response = await salvarNota(dadosParaEnviar)

            if (response.success === false || !response.novaNota) {
                Swal.fire('Erro!', response.error, 'error');
                setLoading(false)
                return;
            }

            Swal.fire('Nota Lançada!!', '', 'success');

            atualizar(response.novaNota as unknown as Notas);
            sair()
        } catch (error: any) {
            Swal.fire('Erro!', error, 'error')
        } finally {
            setLoading(false)
        }
    }

    const formatarDataParaInput = (data: Date) => {
        return data.toISOString().split('T')[0];
    };

    const [data, setData] = useState(formatarDataParaInput(new Date()))
    const [vencimento, setVencimento] = useState('')
    // "paga todo dia 10" (vem da última nota do cliente que teve data combinada), quanto deve, limite e observações
    const [info, setInfo] = useState<Awaited<ReturnType<typeof infoDoClienteNaNota>>>(null)
    const diaDoCliente = info?.dia ?? null

    async function escolherCliente(id: string) {
        setCliete(id)
        setInfo(null)
        const novaInfo = await infoDoClienteNaNota(Number(id))
        setInfo(novaInfo)
        const dia = novaInfo?.dia ?? null
        // já sugere o dia de sempre desse cliente; o usuário pode trocar ou tirar
        setVencimento(dia ? proximoDiaDoMes(data, dia) : '')
    }

    const atalhos = [
        ...(diaDoCliente ? [{ rotulo: `Dia ${diaDoCliente}`, valor: proximoDiaDoMes(data, diaDoCliente) }] : []),
        { rotulo: '7 dias', valor: somarDias(data, 7) },
        { rotulo: '15 dias', valor: somarDias(data, 15) },
        { rotulo: '30 dias', valor: somarDias(data, 30) },
        { rotulo: 'Sem data', valor: '' },
    ]

    return (

        <Cortina onClick={sair}>
            <Container tamanho="m">
                <Titulo texto="Lançar nota" cor="preto" />
                <Button tamanho="g" texto="X" tipo="fechar" corTexto="branco" onClick={sair} />

                <form className="w-full flex items-center justify-center flex-col gap-4 "
                    onSubmit={enviar}>

                    <Label texto="Cliente">
                        <Selects tamanho='g' value={cliente} onChange={(e) => escolherCliente(e)}>
                            <option value="" disabled>Selecione o cliente</option>

                            {clientes.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.nome}{c.apelido ? ` (${c.apelido})` : ''}
                                </option>
                            ))}

                        </Selects>
                    </Label>

                    {info?.bloqueado && (
                        <p className="w-full rounded-lg bg-red-50 ring-1 ring-red-600/20 px-3 py-2 text-sm font-medium text-red-700">
                            Fiado bloqueado pra esse cliente.
                        </p>
                    )}
                    {info && (info.observacoes || info.limite) && (
                        <div className="w-full rounded-lg bg-slate-50 ring-1 ring-slate-900/10 px-3 py-2 text-sm text-slate-700 space-y-0.5">
                            {info.observacoes && <p className="whitespace-pre-line"><span className="font-medium">Obs.:</span> {info.observacoes}</p>}
                            {info.limite && (
                                <p className={info.deve >= info.limite ? 'text-amber-700 font-medium' : ''}>
                                    Deve {FormatarValor(info.deve)} de um limite de {FormatarValor(info.limite)}
                                </p>
                            )}
                        </div>
                    )}

                    <Label texto="Data">
                        <Input type="date" value={data} onChange={(e) => setData(e)} tamanho="g" name="data" placeholder="" />
                    </Label>

                    {segmento === 'pet' && (
                        <>
                            <div className=" w-3/5 justify-center gap-2 flex ">

                                <Label texto="Diarias">
                                    <Input type="number" tamanho="g" name="quantidade" placeholder="ex.: 5" />
                                </Label>

                                <Label texto="Valor da diaria">
                                    <Input type="text" tamanho="g" name="valor" placeholder="ex: 99,90" />
                                </Label>
                            </div>

                            <Label texto="Nome do animal">
                                <Input type="text" tamanho="g" name="descricao" placeholder="ex.: Nala" />
                            </Label>

                            <Label texto="Valor extra (banho, táxi-dog, etc)">
                                <Input type="text" tamanho="g" name="extra" placeholder="ex.: 20,00" />
                            </Label>

                        </>
                    )}

                    {segmento === 'geral' && (
                        <>
                            <Label texto="Valor">
                                <Input placeholder="ex.: 549,90" type="text" tamanho="g" name="valor" />
                            </Label>

                            <Label texto="Descrição">
                                <Input placeholder="Opcional" type="text" tamanho="g" name="descricao" />
                            </Label>
                        </>

                    )}


                    <div className="w-full">
                    <Label texto="Combinou de pagar em">
                        {/* input nativo (e não o componente Input) porque os atalhos trocam o valor e o Input usa defaultValue */}
                        <input
                            type="date"
                            name="vencimento"
                            value={vencimento}
                            min={data}
                            onChange={(e) => setVencimento(e.target.value)}
                            className="w-full bg-white rounded-lg ring-1 ring-slate-900/10 px-3.5 py-2.5 text-base text-left outline-none focus:ring-2 focus:ring-marca-700 transition-shadow"
                        />
                    </Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {atalhos.map(a => (
                                <button
                                    key={a.rotulo}
                                    type="button"
                                    onClick={() => setVencimento(a.valor)}
                                    className={`px-3 py-1.5 rounded-full text-sm ring-1 ring-inset cursor-pointer transition-colors ${
                                        vencimento === a.valor ? 'bg-marca-950 text-white ring-marca-950' : 'bg-white text-slate-700 ring-slate-900/10 hover:bg-slate-50'
                                    }`}
                                >
                                    {a.rotulo}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button funcao="submit" texto="Lançar nota" tipo="btn02" tamanho="gg" corTexto="cinza" />

                </form>

            </Container>

            <Loading ativo={loading} />
        </Cortina>

    )
}