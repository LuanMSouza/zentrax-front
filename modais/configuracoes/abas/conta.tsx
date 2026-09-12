'use client'

import { useEffect, useState } from "react"
import { ApagarContaBack, ConfirmarSenha, PegarUsuariosDaConta } from "./actions"
import Swal from "sweetalert2"
import CriarUsuario from "@/modais/criarUsuario/page"
import AlterarUsuario from "@/modais/alterarConta/page"

type ContaConfigProps = {
    usuario: any,
    empresa: any,
}

export default function ContaConfig({ usuario, empresa }: ContaConfigProps) {

    const [usuarios, setUsuarios] = useState<any[]>([])

    const [modalCriarUsuario, setModalCriarUsuario] = useState(false)
    const [modalAlterarUsuario, setModalAlterarUsuario] = useState(false)

    const [usuarioSelecionado, setUsuarioSelecionado] = useState(null)


    useEffect(() => {
        const buscarDados = async () => {
            if (empresa?.id) {
                const res = await PegarUsuariosDaConta({ id: empresa.id })
                if (res?.usuarios) {
                    setUsuarios(res.usuarios)
                }
            }
        }
        buscarDados()
    }, [empresa?.id])



    async function criarConta() {
        try {
            const result = await Swal.fire({
                title: 'Sua senha...',
                text: 'Toda alteração de conta precisa de autenticação!',
                icon: 'question',
                input: 'password',
                inputAttributes: { autocomplete: 'new-password' },
                confirmButtonText: 'Prosseguir!',
                showCancelButton: true,
                cancelButtonText: 'Cancelar!'
            })
            if (result.isConfirmed) {

                const resVerificacao = await ConfirmarSenha({ id: usuario.id, senha: result.value })
                if (!resVerificacao.success) {
                    return Swal.fire('Opa...', 'Sua senha não coincide!', 'error')
                }
            } else {
                return
            }
            setModalCriarUsuario(true)
        } catch (error: any) {
            Swal.fire('Opa...', error, 'error')
        }
    }

    async function alterarConta(id: number) {

        const result = await Swal.fire({
            title: 'Sua senha...',
            text: 'Toda alteração de conta precisa de autenticação!',
            icon: 'question',
            input: 'password',
            inputAttributes: { autocomplete: 'new-password' },
            confirmButtonText: 'Prosseguir!',
            showCancelButton: true,
            cancelButtonText: 'Cancelar!'
        })
        if (result.isConfirmed) {
            const resVerificacao = await ConfirmarSenha({ id: usuario.id, senha: result.value })
            if (!resVerificacao.success) {
                return Swal.fire('Opa...', 'Sua senha não coincide!', 'error')
            }
        } else {
            return
        }


        setModalAlterarUsuario(true)

    }

    async function excluirConta(id: number) {
        const result = await Swal.fire({
            title: 'Sua senha...',
            text: 'Toda alteração de conta precisa de autenticação!',
            icon: 'question',
            input: 'password',
            inputAttributes: { autocomplete: 'new-password' },
            confirmButtonText: 'Prosseguir!',
            showCancelButton: true,
            cancelButtonText: 'Cancelar!'
        })
        if (result.isConfirmed) {
            const resVerificacao = await ConfirmarSenha({ id: usuario.id, senha: result.value })
            if (!resVerificacao.success) {
                return Swal.fire('Opa...', 'Sua senha não coincide!', 'error')
            }
        } else {
            return
        }

        const res = await ApagarContaBack(id)

        if (res.success) {
            Swal.fire('Sucesso!!', 'Conta apagada com sucesso!!', 'success')
            setUsuarios(prev => prev.filter(u => u.id !== id));
        } else {
            Swal.fire('Opa...', 'Erro desconhecido!!', 'error')
        }
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-blue-600">Usuários</h2>

            <div className="grid gap-2 relative p-2 px-4 min-h-45">

                {usuario.role !== 'gestor' &&
                    <div className="w-full h-full bg-slate-900/70 absolute backdrop-blur rounded-2xl shadow-2xl flex flex-col justify-center items-center text-center px-4" >
                        <p className="text-2xl text-white font-bold">Opa...</p>
                        <p className="text-white">Essa area é somente para <strong>gestores</strong>!!</p>
                    </div>}

                {usuarios.length > 1 ? (
                    usuarios.map((u: any) => {

                        if (u.id === usuario.id) return

                        return (
                            <div key={u.id} className="p-3 w-full bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                                <p className="text-gray-900">{u.nome} <span className="text-gray-500 text-sm">· {u.usuario}</span></p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => excluirConta(u.id)}
                                        aria-label="Remover usuário"
                                        title="Remover usuário"
                                        className="bg-red-600 hover:bg-red-700 active:scale-95 transition-all cursor-pointer rounded-lg w-8 h-8 flex justify-center items-center text-white text-lg shrink-0"
                                    >
                                        ✕
                                    </button>

                                    <button
                                        onClick={() => {
                                            alterarConta(u.id)
                                            setUsuarioSelecionado(u)
                                        }}
                                        aria-label="Editar usuário"
                                        title="Editar usuário"
                                        className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer rounded-lg w-8 h-8 flex justify-center items-center text-white text-base shrink-0"
                                    >
                                        ✎
                                    </button>

                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-gray-500 italic">Nenhum usuário além de você encontrado</p>
                )}

                <button
                    onClick={criarConta}
                    className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer p-2 text-xl text-white rounded ">Adicionar Conta</button>
            </div>


            {/* modais */}
            {modalCriarUsuario &&
                <CriarUsuario
                    atualizar={(novoU) => setUsuarios([...usuarios, novoU])}
                    sair={() => setModalCriarUsuario(false)}
                    empresa={empresa} />
            }

            {modalAlterarUsuario &&
                <AlterarUsuario
                    atualizar={(atualizarU) => setUsuarios(usuarios.map(u => u.id === atualizarU.id ? atualizarU : u))
                    } usuario={usuarioSelecionado}
                    sair={() => {
                        setModalAlterarUsuario(false)
                        setUsuarioSelecionado(null)
                    }}
                />
            }
        </div >
    )
}