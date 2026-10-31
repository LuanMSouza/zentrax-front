'use client'

import { useEffect, useRef, useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import Titulo from "@/componentes/Titulo"
import { Button } from "@/componentes/Buttons"
import { AlterarClienteBack, ApagarClienteBack, PegarImpactoClienteBack } from "./actions"
import { ConfirmarSenha } from "@/modais/configuracoes/abas/actions"
import { Cliente } from "@/types"
import { MapaPermissoes } from "@/lib/permissoes"
import CamposExtrasCliente, { EXTRAS_VAZIOS, extrasDoCliente, campo, rotulo } from "@/componentes/CamposExtrasCliente"
import { bateBusca, textoAniversario } from "@/lib/cliente"

type EditarClientesProps = {
    clientes: Cliente[],
    pode: MapaPermissoes, // excluir e bloquear: gestor, ou atendente liberado
    sair: () => void,
    atualizar: (cliente: Cliente) => void,
    remover: (id: number) => void
}

export default function EditarClientes({ clientes, pode, sair, atualizar, remover }: EditarClientesProps) {

    const [filtro, setFiltro] = useState('')
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [form, setForm] = useState({ nome: '', whatsapp: '', documento: '' })
    const [extras, setExtras] = useState(EXTRAS_VAZIOS)
    const [bloqueado, setBloqueado] = useState(false)
    const [salvando, setSalvando] = useState(false)
    const [excluindoId, setExcluindoId] = useState<number | null>(null)
    const topo = useRef<HTMLDivElement>(null)

    // lista e formulário dividem a rolagem da Cortina: sem isso, no celular o formulário abre no meio
    useEffect(() => { topo.current?.closest('[role=dialog]')?.scrollTo({ top: 0 }) }, [editandoId])

    function iniciarEdicao(c: Cliente) {
        setEditandoId(c.id)
        setForm({
            nome: c.nome,
            whatsapp: c.whatsapp ? String(c.whatsapp) : '',
            documento: c.documento ?? ''
        })
        setExtras(extrasDoCliente(c))
        setBloqueado(c.bloqueado === true)
    }

    function cancelarEdicao() {
        setEditandoId(null)
    }

    async function salvar(id: number) {
        if (!form.nome.trim()) {
            Swal.fire('Opa...', 'O nome é obrigatório.', 'warning')
            return
        }

        setSalvando(true)

        try {
            const res = await AlterarClienteBack({ id, ...form, ...extras, bloqueado })

            if (res.success && res.clienteAtualizado) {
                Swal.fire('Sucesso!', 'Cliente atualizado com sucesso!', 'success')
                atualizar(res.clienteAtualizado as Cliente)
                setEditandoId(null)
            } else {
                Swal.fire('Opa...', res.error, 'error')
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro ao atualizar cliente.', 'error')
        } finally {
            setSalvando(false)
        }
    }

    async function excluir(c: Cliente) {
        setExcluindoId(c.id)

        try {
            const impacto = await PegarImpactoClienteBack(c.id)

            if (!impacto.success) {
                Swal.fire('Opa...', impacto.error, 'error')
                return
            }

            const temHistorico = (impacto.quantidadeNotas ?? 0) > 0 || (impacto.quantidadePagamentos ?? 0) > 0

            const confirm1 = await Swal.fire({
                titleText: `Excluir ${c.nome}?`, // titleText: o `title` do SweetAlert é HTML e o nome do cliente vem do usuário
                html: temHistorico
                    ? `Esse cliente tem <b>${impacto.quantidadeNotas} nota(s)</b> e <b>${impacto.quantidadePagamentos} pagamento(s)</b> registrados.<br/><br/><span style="color:#b91c1c">Tudo isso será apagado PERMANENTEMENTE junto com o cliente. Não dá pra desfazer.</span>`
                    : 'Esse cliente não tem notas nem pagamentos registrados. A exclusão não pode ser desfeita.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Continuar',
                confirmButtonColor: '#dc2626',
                cancelButtonText: 'Cancelar'
            })

            if (!confirm1.isConfirmed) return

            const confirm2 = await Swal.fire({
                title: 'Sua senha...',
                text: 'Toda exclusão precisa de autenticação!',
                icon: 'question',
                input: 'password',
                inputAttributes: { autocomplete: 'new-password' },
                confirmButtonText: 'Excluir definitivamente',
                confirmButtonColor: '#dc2626',
                showCancelButton: true,
                cancelButtonText: 'Cancelar'
            })

            if (!confirm2.isConfirmed) return

            const resSenha = await ConfirmarSenha({ senha: String(confirm2.value) })

            if (!resSenha.success) {
                Swal.fire('Opa...', 'Sua senha não coincide!', 'error')
                return
            }

            const res = await ApagarClienteBack(c.id)

            if (res.success) {
                Swal.fire('Excluído!', 'Cliente removido com sucesso.', 'success')
                remover(c.id)
                setEditandoId(null)
            } else {
                Swal.fire('Opa...', res.error, 'error')
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro ao excluir cliente.', 'error')
        } finally {
            setExcluindoId(null)
        }
    }

    const clientesFiltrados = clientes
        .filter(c => bateBusca(c, filtro))
        .sort((a, b) => a.nome.localeCompare(b.nome))

    const editando = clientes.find(c => c.id === editandoId) ?? null

    return (
        <Cortina onClick={sair}>
            <Container tamanho="mg">
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />

                <div ref={topo} className="absolute top-0" aria-hidden />

                {editando ? (
                    // o card cabe na tela (respiro em cima e embaixo) e só os campos rolam: Salvar sempre à vista
                    <div className="flex flex-col gap-5 max-h-[calc(100dvh-5rem)] sm:max-h-[calc(100dvh-9rem)]">
                        <div className="pr-10 shrink-0">
                            <button onClick={cancelarEdicao}
                                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
                                Voltar pra lista
                            </button>
                            <div className="mt-3 flex items-center gap-3 min-w-0">
                                <Iniciais nome={editando.nome} grande />
                                <div className="min-w-0">
                                    <Titulo texto={editando.nome} cor="preto" />
                                    <p className="text-sm text-slate-500">Editando cadastro</p>
                                </div>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1 pb-1 flex flex-col gap-5">
                            <section className="flex flex-col gap-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Principal</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className={`${rotulo} sm:col-span-2`}>
                                        Nome
                                        <input value={form.nome} onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))} className={campo} />
                                    </label>
                                    <label className={rotulo}>
                                        WhatsApp
                                        <input value={form.whatsapp} inputMode="tel" placeholder="ex.: 11 99887-7665"
                                            onChange={(e) => setForm(prev => ({ ...prev, whatsapp: e.target.value }))} className={campo} />
                                    </label>
                                    <label className={rotulo}>
                                        CPF/CNPJ
                                        <input value={form.documento} placeholder="Opcional"
                                            onChange={(e) => setForm(prev => ({ ...prev, documento: e.target.value }))} className={campo} />
                                    </label>
                                </div>
                            </section>

                            {pode.bloquear && (
                                <label className={`flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer ring-1 transition-colors ${bloqueado ? 'bg-red-50 ring-red-600/20' : 'bg-slate-50 ring-slate-900/5'}`}>
                                    <input type="checkbox" checked={bloqueado} onChange={(e) => setBloqueado(e.target.checked)}
                                        className="mt-0.5 accent-red-600 w-5 h-5 cursor-pointer shrink-0" />
                                    <span>
                                        <span className={`block text-sm font-medium ${bloqueado ? 'text-red-700' : 'text-slate-700'}`}>Não vender mais fiado pra esse cliente</span>
                                        <span className="block text-xs text-slate-500 mt-0.5">Ao lançar uma nota pra ele, aparece um aviso vermelho pedindo confirmação.</span>
                                    </span>
                                </label>
                            )}

                            <section className="flex flex-col gap-4 border-t border-slate-100 pt-5">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mais detalhes (opcional)</h3>
                                <CamposExtrasCliente valor={extras} onChange={setExtras} solto />
                            </section>

                        </div>

                        <div className="shrink-0 border-t border-slate-100 pt-4 sm:pt-5 flex items-center gap-2 sm:gap-3">
                            {pode.excluir && (
                                <button onClick={() => excluir(editando)} disabled={excluindoId !== null}
                                    className="-ml-3 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 cursor-pointer transition-colors disabled:opacity-50">
                                    {excluindoId === editando.id ? 'Excluindo...' : 'Excluir cliente'}
                                </button>
                            )}
                            <button onClick={cancelarEdicao}
                                className="ml-auto px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50 cursor-pointer transition-colors">
                                Cancelar
                            </button>
                            <button onClick={() => salvar(editando.id)} disabled={salvando}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-marca-700 hover:bg-marca-800 cursor-pointer transition-colors disabled:opacity-60">
                                {salvando ? 'Salvando...' : <>Salvar<span className="hidden sm:inline"> alterações</span></>}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="pr-10">
                            <Titulo texto="Editar clientes" cor="preto" />
                            <p className="text-sm text-slate-500 mt-0.5">{clientes.length} {clientes.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}. Toque num cliente pra editar.</p>
                        </div>

                        <div className="relative">
                            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                            <input name="filtro" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)}
                                placeholder="Buscar pelo nome ou apelido" className={`${campo} pl-10`} />
                        </div>

                        <ul className="-mx-2 flex flex-col max-h-[26rem] overflow-y-auto">
                            {clientesFiltrados.length === 0 && (
                                <li className="text-sm text-slate-500 text-center py-8">Nenhum cliente encontrado.</li>
                            )}

                            {clientesFiltrados.map(c => {
                                const aniversario = textoAniversario(c.aniversario_dia, c.aniversario_mes)
                                const detalhes = [c.whatsapp ? String(c.whatsapp) : 'Sem WhatsApp', aniversario && `aniversário ${aniversario}`].filter(Boolean).join(' · ')
                                return (
                                    <li key={c.id}>
                                        <button onClick={() => iniciarEdicao(c)}
                                            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left hover:bg-slate-50 cursor-pointer transition-colors group">
                                            <Iniciais nome={c.nome} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block font-medium text-slate-900 truncate">
                                                    {c.nome}{c.apelido && <span className="font-normal text-slate-500"> ({c.apelido})</span>}
                                                </span>
                                                <span className="block text-sm text-slate-500 truncate">{detalhes}</span>
                                            </span>
                                            <svg className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                )}
            </Container>
        </Cortina>
    )
}

// Bolinha com as iniciais (MS pra Maria Silva): ajuda a achar o cliente na lista sem ler o nome todo
function Iniciais({ nome, grande = false }: { nome: string, grande?: boolean }) {
    const partes = nome.trim().split(/\s+/)
    const letras = (partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')
    return (
        <span aria-hidden className={`shrink-0 inline-flex items-center justify-center rounded-full bg-marca-100 text-marca-700 font-semibold uppercase ${grande ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'}`}>
            {letras}
        </span>
    )
}
