"use client";
import { useEffect, useState } from "react";
import ResumoTopo from "@/blocos/ResumoTopo";
import { IconeBusca, IconeOlho, IconeOlhoFechado, IconeMais } from "@/componentes/Icones";
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
    // padrão: quem está há mais tempo devendo primeiro (antes era ordem alfabética)
    const [arrumacao, setArrumacao] = useState('data_desc')
    const [aba, setAba] = useState<'devedores' | 'pagamentos'>('devedores')
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

    const filtrados = listaOrdenada.filter(e => e.nome.toLowerCase().includes(filtro.toLowerCase()))

    const abaCls = (ativa: boolean) =>
        `px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
            ativa ? 'bg-marca-950 text-white' : 'text-slate-600 hover:bg-slate-200/70'
        }`

    return (
        <>
            <TopBar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Contas em aberto</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setModalLancarNotas(true)}
                            className="inline-flex items-center gap-1.5 bg-marca-700 hover:bg-marca-800 active:scale-[0.98] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
                        >
                            <IconeMais /> Cadastrar nota
                        </button>
                        <button
                            onClick={() => setModalCriarCliente(true)}
                            className="bg-white ring-1 ring-slate-900/10 hover:ring-marca-700/40 active:scale-[0.98] text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
                        >
                            Cadastrar cliente
                        </button>
                        <button
                            onClick={() => setModalEditarClientes(true)}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 decoration-slate-300 px-2 py-2 cursor-pointer"
                        >
                            Editar clientes
                        </button>
                    </div>
                </div>

                <ResumoTopo emAberto={emAberto} role={role} mostrarValores={mostrarValores} />

                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    {aba === 'devedores' && (
                        <>
                            <div className="relative w-full sm:flex-1">
                                <IconeBusca className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                                <input
                                    type="search"
                                    value={filtro}
                                    onChange={(e) => setFiltro(e.target.value)}
                                    placeholder="Buscar cliente pelo nome"
                                    aria-label="Buscar cliente pelo nome"
                                    className="w-full pl-10 pr-3 py-2.5 bg-white rounded-lg ring-1 ring-slate-900/10 text-sm outline-none focus:ring-2 focus:ring-marca-700 transition-shadow"
                                />
                            </div>
                            <select
                                value={arrumacao}
                                onChange={(e) => setArrumacao(e.target.value)}
                                aria-label="Ordenar clientes"
                                className="flex-1 sm:flex-none min-w-0 bg-white rounded-lg ring-1 ring-slate-900/10 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-marca-700 cursor-pointer"
                            >
                                <option value="data_desc">Mais atrasados</option>
                                <option value="data_asc">Mais recentes</option>
                                <option value="valor_asc">Maior valor</option>
                                <option value="valor_desc">Menor valor</option>
                                <option value="notas_asc">Mais notas</option>
                                <option value="notas_desc">Menos notas</option>
                                <option value="nome_asc">Nome A-Z</option>
                                <option value="nome_desc">Nome Z-A</option>
                            </select>
                        </>
                    )}
                    <button
                        onClick={() => setMostrarValores(!mostrarValores)}
                        aria-pressed={mostrarValores}
                        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ring-1 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                            aba === 'devedores' ? 'flex-1 sm:flex-none' : ''
                        } ${mostrarValores ? 'bg-marca-100 text-marca-800 ring-marca-700/30' : 'bg-white text-slate-700 ring-slate-900/10 hover:ring-marca-700/40'}`}
                    >
                        {mostrarValores ? <IconeOlho /> : <IconeOlhoFechado />}
                        {mostrarValores ? 'Valores visíveis' : 'Valores ocultos'}
                    </button>
                </div>

                <div className="flex gap-1 p-1 bg-slate-200/60 rounded-xl w-fit" role="tablist">
                    <button role="tab" aria-selected={aba === 'devedores'} onClick={() => setAba('devedores')} className={abaCls(aba === 'devedores')}>
                        Devedores <span className="opacity-70 tabular-nums">({emAberto.length})</span>
                    </button>
                    <button role="tab" aria-selected={aba === 'pagamentos'} onClick={() => setAba('pagamentos')} className={abaCls(aba === 'pagamentos')}>
                        Pagamentos
                    </button>
                </div>

                {aba === 'devedores' ? (
                    <>
                        {!loading && emAberto.length === 0 && (
                            <div className="bg-white rounded-2xl ring-1 ring-slate-900/5 p-10 text-center">
                                <p className="font-medium text-slate-900">Nenhuma conta em aberto</p>
                                <p className="text-sm text-slate-500 mt-1">Cadastre um cliente e lance a primeira nota para começar.</p>
                            </div>
                        )}
                        {emAberto.length > 0 && filtrados.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-8">Nenhum cliente encontrado para &ldquo;{filtro}&rdquo;.</p>
                        )}
                        <BlocoClientes
                            valor={mostrarValores}
                            clientes={filtrados}
                            onClick={(c) => {
                                setClienteSelect(c)
                                setModalClienteDetalhado(true)
                            }}
                        />
                    </>
                ) : (
                    <BlocoPagamentos
                        MostrarValor={mostrarValores}
                        pagamentos={pagamentos}
                        temMaisNoServidor={temMaisPagamentos}
                        carregandoMais={carregandoMaisPagamentos}
                        carregarMais={carregarMaisPagamentos}
                    />
                )}
            </main>

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