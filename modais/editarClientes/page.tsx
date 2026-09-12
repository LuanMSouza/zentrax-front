'use client'

import { useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import Titulo from "@/componentes/Titulo"
import { Button } from "@/componentes/Buttons"
import Input from "@/componentes/Inputs"
import { AlterarClienteBack, ApagarClienteBack, PegarImpactoClienteBack } from "./actions"
import { ConfirmarSenha } from "@/modais/configuracoes/abas/actions"
import { Cliente } from "@/types"

type EditarClientesProps = {
    clientes: Cliente[],
    role: string | null,
    sair: () => void,
    atualizar: (cliente: Cliente) => void,
    remover: (id: number) => void
}

export default function EditarClientes({ clientes, role, sair, atualizar, remover }: EditarClientesProps) {

    const [filtro, setFiltro] = useState('')
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [form, setForm] = useState({ nome: '', whatsapp: '', documento: '' })
    const [salvando, setSalvando] = useState(false)
    const [excluindoId, setExcluindoId] = useState<number | null>(null)

    function iniciarEdicao(c: Cliente) {
        setEditandoId(c.id)
        setForm({
            nome: c.nome,
            whatsapp: c.whatsapp ? String(c.whatsapp) : '',
            documento: c.documento ?? ''
        })
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
            const res = await AlterarClienteBack({ id, ...form })

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
                title: `Excluir ${c.nome}?`,
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
        .filter(c => c.nome.toLowerCase().includes(filtro.toLowerCase()))
        .sort((a, b) => a.nome.localeCompare(b.nome))

    return (
        <Cortina onClick={sair}>
            <Container tamanho="mg">
                <Titulo texto="Editar clientes" cor="preto" />
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />

                <Input name="filtro" tamanho="g" type="text" value={filtro} placeholder="Filtrar pelo nome..." onChange={(e) => setFiltro(e)} />

                <div className="w-full flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {clientesFiltrados.length === 0 && (
                        <p className="text-gray-500 italic text-center py-4">Nenhum cliente encontrado.</p>
                    )}

                    {clientesFiltrados.map(c => (
                        <div key={c.id} className="border border-gray-300 rounded-xl p-3 shadow-sm bg-white">
                            {editandoId === c.id ? (
                                <div className="flex flex-col gap-2">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs text-gray-500">Nome</span>
                                        <input
                                            value={form.nome}
                                            onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                                            className="border border-gray-300 rounded-lg p-2 text-gray-900 outline-none focus:border-blue-500"
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs text-gray-500">Whatsapp</span>
                                        <input
                                            value={form.whatsapp}
                                            onChange={(e) => setForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                                            placeholder="ex: 11 99887-7665"
                                            className="border border-gray-300 rounded-lg p-2 text-gray-900 outline-none focus:border-blue-500"
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-xs text-gray-500">CPF/CNPJ</span>
                                        <input
                                            value={form.documento}
                                            onChange={(e) => setForm(prev => ({ ...prev, documento: e.target.value }))}
                                            placeholder="Opcional"
                                            className="border border-gray-300 rounded-lg p-2 text-gray-900 outline-none focus:border-blue-500"
                                        />
                                    </label>

                                    <div className="flex gap-2 mt-1">
                                        <Button onClick={() => salvar(c.id)} texto={salvando ? 'Salvando...' : 'Salvar'} tipo="btn01" tamanho="m" corTexto="branco" />
                                        <Button onClick={cancelarEdicao} texto="Cancelar" tipo="btn05" tamanho="m" corTexto="branco" />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{c.nome}</p>
                                        <p className="text-sm text-gray-500 truncate">
                                            {c.whatsapp ? `Whats: ${c.whatsapp}` : 'Sem whatsapp'}
                                            {c.documento ? ` · Doc: ${c.documento}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button onClick={() => iniciarEdicao(c)} texto="Editar" tipo="btn03" tamanho="p" corTexto="branco" />
                                        {role === 'gestor' && (
                                            <Button
                                                onClick={() => excluir(c)}
                                                texto={excluindoId === c.id ? '...' : 'Excluir'}
                                                tipo="btn05"
                                                tamanho="p"
                                                corTexto="branco"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Container>
        </Cortina>
    )
}
