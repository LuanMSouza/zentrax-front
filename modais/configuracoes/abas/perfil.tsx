'use client'
import { useState } from "react"
import Swal from "sweetalert2"
import { motion, AnimatePresence } from "framer-motion"
import { Alterarperfil, ConfirmarSenha } from "./actions"


type resAtualizar = {
    usuarioNovo: usuarioNovoProps[]
}

type usuarioNovoProps = {
    id: number,
    nome: string,
    usuario: string
}


export default function PerfilConfig({ usuario, atualizar }: { usuario: any, atualizar: (e: resAtualizar) => void }) {

    const [form, setForm] = useState({
        id: Number(usuario.id),
        nome: usuario.nome,
        usuario: usuario.usuario,
        senha: '',
        confirmarSenha: '',
    })


    const handleSubmit = async () => {
        if (!form.nome || !form.usuario) {
            return Swal.fire('Opa...', 'Nome e usuario são obrigatórios', 'warning')
        }

        if (form.senha) {
            if (form.senha !== form.confirmarSenha) {
                return Swal.fire('Opa...', 'As senhas não coincidem!', 'error')
            }

            const result = await Swal.fire({
                title: 'Senha atual',
                text: 'Toda alteração de senha precisa de autenticação!',
                icon: 'question',
                input: 'password',
                confirmButtonText: 'Alterar!',
                showCancelButton: true,
                cancelButtonText: 'Cancelar!',
            })

            if (result.isConfirmed) {
                const senhaAtual = String(result.value)
                const resVerificacao = await ConfirmarSenha({ id: form.id, senha: senhaAtual })

                if (!resVerificacao.success) {
                    return Swal.fire('Opa...', 'Sua senha antiga não coincide!', 'error')
                }
            } else {
                return // Usuário cancelou o modal de senha
            }
        }

        const res = await Alterarperfil(form)

        if (res.success && res.usuarioNovo) {
            await Swal.fire('Sucesso!!', 'Usuario alterado com sucesso!!', 'success')

            atualizar({ usuarioNovo: res.usuarioNovo })

            setForm(prev => ({ ...prev, senha: '', confirmarSenha: '' }))

        } else {
            Swal.fire('Erro', 'Não foi possível atualizar o perfil', 'error')
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-indigo-400">Editar Perfil</h2>

            <div className="grid grid-cols-1 gap-4">
                {/* nome */}
                <label className="block">
                    <span className="text-gray-400 text-sm">Nome</span>
                    <input
                        name='nome'
                        type='text'
                        value={form.nome}
                        onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 focus:outline-none focus:border-indigo-400 transition-colors"
                        placeholder='Seu nome...'
                    />
                </label>

                {/* usuario */}
                <label className="block">
                    <span className="text-gray-400 text-sm">Nome de usuario</span>
                    <input
                        name='nome'
                        type='text'
                        value={form.usuario}
                        onChange={(e) => setForm(prev => ({ ...prev, usuario: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 focus:outline-none focus:border-indigo-400 transition-colors"
                        placeholder='Seu usuario...'
                    />
                </label>

                {/* senha */}
                <label className="block">
                    <span className="text-gray-400 text-sm">Nova senha</span>
                    <input
                        name='senha'
                        type='password'
                        value={form.senha}
                        onChange={(e) => setForm(prev => ({ ...prev, senha: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 focus:outline-none focus:border-indigo-400 transition-colors"
                        placeholder='Nova senha...'
                        autoComplete="new-password"
                    />
                </label>

                <AnimatePresence>
                    {form.senha && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            className="overflow-hidden" // Essencial para o efeito de deslize
                        >
                            <label className="block animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="text-gray-400 text-sm">Confirmar nova senha</span>
                                <input
                                    name="confirmarSenha" // Mudei o name para não conflitar com 'nome'
                                    type="password"
                                    value={form.confirmarSenha} // Use o estado da senha de confirmação aqui
                                    onChange={(e) => setForm(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded p-2 mt-1 focus:outline-none focus:border-indigo-400 transition-all"
                                    placeholder="Confirme a nova senha..."
                                    autoComplete="new-password"
                                />
                            </label>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={handleSubmit}
                    className="bg-indigo-500 cursor-pointer hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded transition-all active:scale-95 mt-2"
                >
                    Salvar Alterações
                </button>
            </div>
        </div>
    )
}