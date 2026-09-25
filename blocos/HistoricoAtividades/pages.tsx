'use client'

import { useState } from "react"
import { IconeRelogio } from "@/componentes/Icones"
import { pegarAtividades } from "./actions"

type Atividade = {
    id: number
    operacao: string | null
    data: Date | string | null
    usuario: string
}

export default function HistoricoAtividades() {
    const [aberto, setAberto] = useState(false)
    const [loading, setLoading] = useState(false)
    const [atividades, setAtividades] = useState<Atividade[]>([])

    async function abrir() {
        setAberto(true)
        setLoading(true)

        try {
            const res = await pegarAtividades()
            if (res.success && res.atividades) {
                setAtividades(res.atividades)
            }
        } catch (error) {
            console.error('Erro ao carregar atividades:', error)
        } finally {
            setLoading(false)
        }
    }

    function formatarDataHora(data: Date | string | null) {
        if (!data) return ''
        return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    }

    return (
        <>
            <button
                onClick={abrir}
                aria-label="Histórico de atividades"
                className="fixed bottom-5 right-5 z-40 flex items-center gap-2 p-3 sm:pl-3.5 sm:pr-4 sm:py-2.5 rounded-full bg-marca-950 hover:bg-marca-800 active:scale-95 transition-all text-white text-sm font-medium shadow-lg shadow-black/25 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            >
                <IconeRelogio />
                <span className="hidden sm:inline">Histórico</span>
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div
                        onClick={() => setAberto(false)}
                        className="absolute inset-0 bg-black/60"
                    />

                    <div className="relative w-full sm:w-96 h-full bg-white shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
                            <p className="text-xl font-bold text-gray-800">Histórico de atividades</p>
                            <button
                                onClick={() => setAberto(false)}
                                aria-label="Fechar"
                                className="cursor-pointer text-gray-500 hover:text-gray-800 text-2xl leading-none px-1"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {loading && (
                                <p className="text-gray-500 italic text-center mt-4">Carregando...</p>
                            )}

                            {!loading && atividades.length === 0 && (
                                <p className="text-gray-500 italic text-center mt-4">Nenhuma atividade registrada ainda.</p>
                            )}

                            {!loading && atividades.map(a => (
                                <div key={a.id} className="border border-gray-200 rounded-xl p-3 shadow-sm">
                                    <p className="text-gray-800">
                                        <span className="font-bold">{a.usuario}</span> · {a.operacao}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{formatarDataHora(a.data)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
