import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Input from "@/componentes/Inputs";
import Label from "@/componentes/Label";
import Loading from "@/componentes/loading";
import Titulo from "@/componentes/Titulo";
import { useState, useTransition } from "react";
import Swal from "sweetalert2";
import cadastrarClienteBack from "./actions";
import { Cliente } from "@/types";


interface RespostaCadastro {
    success: boolean;
    novoCliente?: Cliente; // Opcional, pois no erro ele pode não vir
    error?: string;        // Opcional, para o caso de falha
}

type CriarProps = {
    sair: () => void,
    atualizar: (cliente: Cliente) => void;
}

export default function CriarCliente({ sair, atualizar }: CriarProps) {

    const [nome, setNome] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [documento, setDocumento] = useState('')
    const [loading, setLoading] = useState(false)



    async function cadastrarCliente(formData: FormData) {

        setLoading(true)

        const result = await cadastrarClienteBack(formData) as RespostaCadastro

        if (result.success && result.novoCliente) {
            Swal.fire('Sucesso!', 'Cliente cadastrado com sucesso!!', 'success')
            atualizar(result.novoCliente)

            sair()
            setLoading(false)
        } else {
            Swal.fire('Erro', result.error, 'error')
            setLoading(false)
        }

    }

    return (
        <>
            <Cortina onClick={sair}>
                <Container tamanho="m">
                    <Titulo texto="Criar cliente" cor="preto" />
                    <Button tamanho="g" texto="X" tipo="fechar" corTexto="branco" onClick={sair} />

                    <form action={cadastrarCliente} className="w-full flex flex-col justify-center items-center gap-5">

                        <Label texto="Nome do cliente">
                            <Input name='nome' tamanho="g" placeholder="Nome do cliente..." type="text" value={nome} onChange={(e) => setNome(e)} />
                        </Label>

                        <Label texto="Whatsapp do cliente">
                            <Input name="whatsapp" tamanho="g" placeholder="ex: 11 99887-7665" type="text" value={whatsapp} onChange={(e) => setWhatsapp(e)} />
                        </Label>

                        <Label texto="CPF/CNPJ">
                            <Input name="documento" tamanho="g" placeholder="Opcional" type="text" value={documento} onChange={(e) => setDocumento(e)} />
                        </Label>

                        <Button texto="Cadastrar!!" tamanho="gg" tipo="btn02" corTexto="cinza" funcao="submit" />

                    </form>
                </Container>
            </Cortina>

            <Loading ativo={loading} />
        </>
    )
}