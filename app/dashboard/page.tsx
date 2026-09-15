"use client";
import Titulo from "@/componentes/Titulo";
import Container from "@/componentes/Container";
import { Button } from "@/componentes/Buttons";
import { useEffect, useState } from "react";
import Input from "@/componentes/Inputs"
import Selects from "@/componentes/Select";
import { BlocoClientes } from "@/blocos/blocoClientes";
import BlocoPagamentos from "@/blocos/blocoPagamentos";
import TopBar from "@/blocos/TopBar/pages";
import Swal from "sweetalert2";
import CriarCliente from "@/modais/criarCliente/page";
import Loading from "@/componentes/loading";
import { pegarClientesBack, pegarPagamentosBack } from "./actions";
import ModalLançarNotas from "@/modais/lancarNotas/pages";
import ClienteDetalhado from "@/modais/clienteDetalhado/page";
import EditarClientes from "@/modais/editarClientes/page";
import { FormatarValor } from "@/lib/mask";

// types
import { Cliente, Pagamentos, ClienteEmAberto } from '@/types'

export default function Home() {
    // Modais
    const [modalCriarCliente, setModalCriarCliente] = useState(false)
    const [modalLancarNotas, setModalLancarNotas] = useState(false)
    const [modalClienteDetalhado, setModalClienteDetalhado] = useState(false)
    const [modalEditarClientes, setModalEditarClientes] = useState(false)

    const [mostrarValores, setMostrarValores] = useState(false)
    const [filtro, setFiltro] = useState('')
    const [arrumacao, setArrumacao] = useState('nome_asc')
    const [loading, setLoading] = useState(true)
    const [role, setRole] = useState<string | null>(null)

    const [clientes, setClientes] = useState<Cliente[]>([])
    const [emAberto, setEmAberto] = useState<ClienteEmAberto[]>([])
    const [pagamentos, setPagamentos] = useState<Pagamentos[]>([])
    const [paginaPagamentos, setPaginaPagamentos] = useState(1)
    const [temMaisPagamentos, setTemMaisPagamentos] = useState(false)
    const [carregandoMaisPagamentos, setCarregandoMaisPagamentos] = useState(false)
    const [clienteSelect, setClienteSelect] = useState<ClienteEmAberto | null>(null);

    async function carregarDados() {
        setLoading(true);
        try {
            const resClientes = await pegarClientesBack();
            const resPagamentos = await pegarPagamentosBack(1);

            if (resClientes.success && resClientes.data) {
                setClientes(resClientes.data.clientes);
                setEmAberto(resClientes.data.emAberto);
            }

            if (resPagamentos.success && resPagamentos.pagamentos) {
                setPagamentos(resPagamentos.pagamentos);
                setPaginaPagamentos(1);
                setTemMaisPagamentos(!!resPagamentos.temMais);
            }

        } catch (error) {
            console.error("Erro no fetch:", error);
            Swal.fire('Erro', 'Erro ao buscar dados', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Reconsulta so os clientes/agregado (mais leve que carregarDados) -
    // usada depois de criar nota, pagar ou editar/remover cliente.
    async function recarregarClientes() {
        try {
            const resClientes = await pegarClientesBack();
            if (resClientes.success && resClientes.data) {
                setClientes(resClientes.data.clientes);
                setEmAberto(resClientes.data.emAberto);
            }
        } catch (error) {
            console.error("Erro ao recarregar clientes:", error);
        }
    }

    async function carregarMaisPagamentos() {
        setCarregandoMaisPagamentos(true);
        try {
            const proximaPagina = paginaPagamentos + 1;
            const resPagamentos = await pegarPagamentosBack(proximaPagina);
            if (resPagamentos.success && resPagamentos.pagamentos) {
                setPagamentos(prev => [...prev, ...resPagamentos.pagamentos]);
                setPaginaPagamentos(proximaPagina);
                setTemMaisPagamentos(!!resPagamentos.temMais);
            }
        } catch (error) {
            console.error("Erro ao carregar mais pagamentos:", error);
        } finally {
            setCarregandoMaisPagamentos(false);
        }
    }

    useEffect(() => {
        carregarDados()

        try {
            const usuarioSalvo = localStorage.getItem('usuario')
            if (usuarioSalvo) {
                setRole(JSON.parse(usuarioSalvo)?.role ?? null)
            }
        } catch (error) {
            console.error('Erro ao carregar usuario do localStorage:', error)
        }
    }, [])

    async function recarregarPagamentos() {
        try {
            const resPagamentos = await pegarPagamentosBack(1);
            if (resPagamentos.success && resPagamentos.pagamentos) {
                setPagamentos(resPagamentos.pagamentos);
                setPaginaPagamentos(1);
                setTemMaisPagamentos(!!resPagamentos.temMais);
            }
        } catch (error) {
            console.error("Erro ao recarregar pagamentos:", error);
        }
    }

    function atualizarClientes(novoCliente: Cliente) {
        setClientes((prev) => [novoCliente, ...prev]);
    }

    function atualizarClienteEditado(clienteEditado: Cliente) {
        setClientes((prev) => prev.map(c => c.id === clienteEditado.id ? clienteEditado : c));
    }

    function removerCliente(id: number) {
        setClientes((prev) => prev.filter(c => c.id !== id));
        setEmAberto((prev) => prev.filter(c => c.id !== id));
        recarregarPagamentos();
    }

    // O agregado (total/quantidade/datas por cliente) ja vem calculado do
    // banco em pegarClientesBack - so ordena e filtra aqui, sem reprocessar
    // as notas inteiras no client.
    const valorTotalNaRua = emAberto.reduce((acc, c) => acc + Number(c.total), 0);

    const listaOrdenada = [...emAberto].sort((a, b) => {
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

    return (
        <>
            <TopBar />
            <Container tamanho="g">
                <Titulo texto="Contas em aberto" cor="preto" />

                <div className="gap-2 flex mb-4">
                    <Button onClick={() => setModalCriarCliente(true)} texto="Cadastrar cliente" tipo="btn01" tamanho="g" corTexto="branco" />
                    <Button onClick={() => setModalLancarNotas(true)} texto="Cadastrar nota" tipo="btn01" tamanho="g" corTexto="branco" />
                    <Button onClick={() => setModalEditarClientes(true)} texto="Editar clientes" tipo="btn01" tamanho="g" corTexto="branco" />
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
                    valor={mostrarValores}
                    clientes={listaOrdenada.filter(e => e.nome.toLowerCase().includes(filtro.toLowerCase()))}
                    onClick={(c) => {
                        setClienteSelect(c)
                        setModalClienteDetalhado(true)
                    }}
                />

                {role === 'gestor' && mostrarValores && (
                    <div className="w-full bg-cyan-100 border-2 border-cyan-400 rounded-2xl p-4 flex flex-col items-center shadow shadow-cyan-700">
                        <p className="text-lg text-gray-700">Valor total na rua</p>
                        <p className="text-3xl font-bold text-gray-900">{FormatarValor(valorTotalNaRua)}</p>
                    </div>
                )}

                <Titulo texto="Pagamentos" cor="preto" />
                <BlocoPagamentos
                    MostrarValor={mostrarValores}
                    pagamentos={pagamentos}
                    temMaisNoServidor={temMaisPagamentos}
                    carregandoMais={carregandoMaisPagamentos}
                    carregarMais={carregarMaisPagamentos}
                />
            </Container>

            {/* Modais */}
            {modalCriarCliente && <CriarCliente atualizar={atualizarClientes} sair={() => setModalCriarCliente(false)} />}
            {modalEditarClientes && <EditarClientes clientes={clientes} role={role} atualizar={atualizarClienteEditado} remover={removerCliente} sair={() => setModalEditarClientes(false)} />}
            {modalLancarNotas && <ModalLançarNotas clientes={clientes} atualizar={() => recarregarClientes()} sair={() => setModalLancarNotas(false)} />}
            {modalClienteDetalhado && clienteSelect && (
                <ClienteDetalhado
                    sair={() => {
                        setClienteSelect(null)
                        setModalClienteDetalhado(false)
                    }}
                    cliente={clienteSelect}
                    atualizarClientes={recarregarClientes}
                    atualizarPagamentos={recarregarPagamentos}
                />
            )}

            <Loading ativo={loading} />
        </>
    );
}