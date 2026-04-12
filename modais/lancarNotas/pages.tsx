import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Input from "@/componentes/Inputs";
import Label from "@/componentes/Label";
import Selects from "@/componentes/Select";
import Titulo from "@/componentes/Titulo";
import { useState } from "react";
import Swal from "sweetalert2";
import { salvarNota } from "./actions";
import Loading from "@/componentes/loading";

// types
import { Cliente, Notas } from '@/types'

type lancarNotas = {
    clientes: Cliente[],
    atualizar: (nota: Notas) => void,
    sair: () => void
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
                quantidade
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

    return (

        <Cortina onClick={sair}>
            <Container tamanho="m">
                <Titulo texto="Lançar nota" cor="preto" />
                <Button tamanho="g" texto="X" tipo="fechar" corTexto="branco" onClick={sair} />

                <form className="w-full flex items-center justify-center flex-col gap-4 "
                    onSubmit={enviar}>

                    <Label texto="Cliente">
                        <Selects tamanho='g' value={cliente} onChange={(e) => setCliete(e)}>
                            <option value="" disabled>Selecione o cliente</option>

                            {clientes.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.nome}
                                </option>
                            ))}

                        </Selects>
                    </Label>

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

                            <Label texto="extras">
                                <Input type="number" tamanho="g" name="extra" placeholder="ex.: Banho, taxi-dog" />
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


                    <Button funcao="submit" texto="Lançar nota" tipo="btn02" tamanho="gg" corTexto="cinza" />

                </form>

            </Container>

            <Loading ativo={loading} />
        </Cortina>

    )
}