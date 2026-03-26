"use client";
import Titulo from "@/componentes/Titulo";
import Container from "@/componentes/Container";
import { Button } from "@/componentes/Buttons";
import { useEffect, useState, useTransition } from "react";
import Input from "@/componentes/Inputs"
import Selects from "@/componentes/Select";
import { BlocoClientes } from "@/blocos/blocoClientes";
import BlocoPagamentos from "@/blocos/blocoPagamentos";
import TopBar from "@/blocos/TopBar/pages";
import Swal from "sweetalert2";
import CriarCliente from "@/modais/criarCliente/page";
import Loading from "@/componentes/loading";
import { pegarClientesBack, pegarNotasBack, pegarPagamentosBack } from "./actions";
import ModalLançarNotas from "@/modais/lancarNotas/pages";
import ClienteDetalhado from "@/modais/clienteDetalhado/page";

// types
import { Cliente, Pagamentos, Notas, ClienteEmAberto } from '@/types'

export default function Home() {

    // Modais
    const [modalCriarCliente, setModalCriarCliente] = useState(false)
    const [modalLancarNotas, setModalLancarNotas] = useState(false)
    const [modalClienteDetalhado, setModalClienteDetalhado] = useState(false)
    // 


    const [mostrarValores, setMostrarValores] = useState(false)
    const [filtro, setFiltro] = useState('')
    const [arrumacao, setArrumacao] = useState('nome_asc')
    const [loading, setLoading] = useState(true)

    // 
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [notas, setNotas] = useState<Notas[]>([])
    const [pagamentos, setPagamentos] = useState<Pagamentos[]>([])
    const [clienteSelect, setClienteSelect] = useState<ClienteEmAberto | null>(null);


    async function carregarDados() {

        setLoading(true)

        try {
            const resClientes = await pegarClientesBack()
            const resNotas = await pegarNotasBack()
            const resPagamentos = await pegarPagamentosBack()

            if (!resClientes.data) {
                throw new Error
            }

            if (resClientes.success) setClientes(resClientes.data.clientes)
            if (resNotas.success) setNotas(resNotas.data)

            if (resPagamentos.pagamentos) {
                if (resPagamentos.success) setPagamentos(resPagamentos.pagamentos)
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro ao buscar clientes', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        carregarDados()
    }, [])

    function atualizarNotas(novaNota: Notas) {

        try {
            setNotas((prev) => [novaNota, ...prev]);
        } catch (error) {
            console.log(error);
        }
    }

    function atualizarClientes(novoCliente: Cliente) {
        setClientes((prev) => [novoCliente, ...prev]);
    }

    const listaDinamica = clientes.map(c => {

        if (!notas) return

        const notasDoCliente = notas?.filter(n =>
            Number(n.id_cliente) === Number(c.id) &&
            (Number(n.valor_inicial) - Number(n.valor_abatido) > 0)
        );

        if (notasDoCliente?.length === 0) return null;

        const total = notasDoCliente?.reduce((acc, n) =>
            acc + (Number(n.valor_inicial) - Number(n.valor_abatido)), 0
        );

        const datas = notasDoCliente?.map(n => new Date(n.data).getTime());

        return {
            id: c.id,
            nome: c.nome,
            total: total?.toString(),
            quantidade_de_notas: notasDoCliente?.length,
            mais_antiga: new Date(Math.min(...datas)).toISOString(),
            mais_nova: new Date(Math.max(...datas)).toISOString()
        };
    }).filter(Boolean) as ClienteEmAberto[];

    const listaOrdenada = listaDinamica.sort((a, b) => {
        if (arrumacao === 'nome_asc') return a.nome.localeCompare(b.nome);
        if (arrumacao === 'nome_desc') return b.nome.localeCompare(a.nome);
        if (arrumacao === 'valor_asc') return Number(b.total) - Number(a.total);
        if (arrumacao === 'valor_desc') return Number(a.total) - Number(b.total);
        if (arrumacao === 'notas_asc') return b.quantidade_de_notas - a.quantidade_de_notas;
        if (arrumacao === 'notas_desc') return a.quantidade_de_notas - b.quantidade_de_notas;
        if (arrumacao === 'data_asc') return new Date(b.mais_nova).getTime() - new Date(a.mais_nova).getTime();
        if (arrumacao === 'data_desc') return new Date(a.mais_antiga).getTime() - new Date(b.mais_antiga).getTime();
        return 0;
    });

    function atualizarNotasAposPagamento(notasAbatidas: Notas[]) {
        setNotas(prevNotas => prevNotas.map(notaOriginal => {
            // 1. Procura se a nota original está dentro do array de notas que foram mexidas
            const notaNova = notasAbatidas.find(n => n.id === notaOriginal.id);

            if (notaNova) {
                return {
                    ...notaOriginal,
                    ...notaNova,
                    valor_abatido: Number(notaNova.valor_abatido),
                    valor_inicial: Number(notaNova.valor_inicial),
                };
            }
            return notaOriginal;
        }));
    }

    return (
        <>
            <TopBar />
            <Container tamanho="g">
                <Titulo texto="Contas em aberto" cor="preto" />

                <div className="gap-2 flex mb-4">
                    <Button onClick={() => setModalCriarCliente(true)} texto="Cadastrar cliente" tipo="btn01" tamanho="g" corTexto="branco" />
                    <Button onClick={() => setModalLancarNotas(true)} texto="Cadastrar nota" tipo="btn01" tamanho="g" corTexto="branco" />
                </div>

                <Button onClick={() => setMostrarValores(!mostrarValores)} texto={mostrarValores ? 'Esconder valores' : 'Visualizar valores'} tipo="btn03" tamanho="gg" corTexto="branco" />

                <Input name="nome" tamanho="m" type="text" value={filtro} placeholder={'Filtre o cliente pelo nome...'} onChange={(e) => setFiltro(e)} />

                <Selects tamanho="p" value={arrumacao} onChange={(e) => setArrumacao(e)}>
                    <option value="nome_asc">Nome A-Z</option>
                    <option value="nome_desc">Nome Z-A</option>
                    <option value="valor_asc">Maior valor</option>
                    <option value="valor_desc">Menor valor</option>
                    <option value="notas_asc">Mais notas</option>
                    <option value="notas_desc">Menos notas</option>
                    <option value="data_desc">Mais antigas</option>
                    <option value="data_asc">Mais novas</option>
                </Selects>

                <BlocoClientes
                    notas={notas}
                    valor={mostrarValores}
                    clientes={listaOrdenada.filter(e => e.nome.toLowerCase().includes(filtro.toLowerCase()))}
                    onClick={(c) => {
                        setClienteSelect(c)
                        setModalClienteDetalhado(true)
                    }}
                />

                <Titulo texto="Pagamentos" cor="preto" />
                <BlocoPagamentos MostrarValor={mostrarValores} pagamentos={pagamentos} />
            </Container>

            {/* Modais */}

            {modalCriarCliente &&
                <CriarCliente
                    atualizar={atualizarClientes}
                    sair={() => setModalCriarCliente(false)} />}

            {modalLancarNotas &&
                <ModalLançarNotas
                    clientes={clientes}
                    atualizar={atualizarNotas}
                    sair={() => setModalLancarNotas(false)} />}

            {modalClienteDetalhado &&
                clienteSelect &&
                <ClienteDetalhado
                    sair={() => {
                        setClienteSelect(null)
                        setModalClienteDetalhado(false)
                    }}
                    cliente={clienteSelect}
                    notas={notas.filter(n => Number(n.id_cliente) === Number(clienteSelect.id))}
                    atualizar={atualizarNotasAposPagamento}
                />}


            <Loading ativo={loading} />
        </>
    );
}   