'use client'

import { useEffect, useState } from "react"
import { ApagarContaBack, ConfirmarSenha, PegarUsuariosDaConta, permissoesAtendenteBack, salvarPermissoesAtendenteBack } from "./actions"
import { LISTA_PERMISSOES, MapaPermissoes, PERMISSOES } from "@/lib/permissoes"
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
            <h2 className="text-xl font-semibold text-marca-700">Usuários</h2>

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
                                        className="bg-marca-700 hover:bg-marca-800 active:scale-95 transition-all cursor-pointer rounded-lg w-8 h-8 flex justify-center items-center text-white text-base shrink-0"
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
                    className="bg-marca-700 hover:bg-marca-800 active:scale-95 transition-all cursor-pointer px-4 py-2.5 text-base font-medium text-white rounded-lg ">Adicionar Conta</button>
            </div>


            {usuario.role === 'gestor' && <PermissoesAtendente />}

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

// O que os atendentes (usuários que não são gestor) podem fazer além do básico. Salva na hora de cada clique.
function PermissoesAtendente() {
    const [permissoes, setPermissoes] = useState<MapaPermissoes | null>(null)
    const [salvando, setSalvando] = useState(false)

    useEffect(() => { permissoesAtendenteBack().then(setPermissoes).catch(() => {}) }, [])

    async function mudar(chave: keyof MapaPermissoes, valor: boolean) {
        if (!permissoes) return
        const antes = permissoes
        const novas = { ...permissoes, [chave]: valor }
        setPermissoes(novas)
        setSalvando(true)
        const res = await salvarPermissoesAtendenteBack(novas).catch(() => null)
        setSalvando(false)
        if (!res?.success) {
            setPermissoes(antes)
            Swal.fire('Opa...', (res as { error?: string } | null)?.error ?? 'Não deu pra salvar agora.', 'error')
        }
    }

    if (!permissoes) return null

    return (
        <section className="space-y-2">
            <div>
                <h2 className="text-xl font-semibold text-marca-700">O que os atendentes podem fazer</h2>
                <p className="text-sm text-gray-500">Gestor pode tudo. Atendente sempre pode lançar nota, receber pagamento, cobrar e cadastrar cliente. Marque o que mais ele pode fazer. {salvando && <span className="text-marca-700">Salvando...</span>}</p>
            </div>
            {LISTA_PERMISSOES.map(chave => (
                <label key={chave} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded p-3 cursor-pointer">
                    <input type="checkbox" checked={permissoes[chave]} onChange={(e) => mudar(chave, e.target.checked)}
                        className="mt-0.5 accent-marca-700 w-5 h-5 cursor-pointer shrink-0" />
                    <span>
                        <span className="block text-gray-700 text-sm md:text-base">{PERMISSOES[chave].rotulo}</span>
                        <span className="block text-gray-500 text-xs md:text-sm">{PERMISSOES[chave].descricao}</span>
                    </span>
                </label>
            ))}
        </section>
    )
}
