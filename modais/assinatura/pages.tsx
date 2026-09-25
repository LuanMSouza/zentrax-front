'use client'

import { useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import { Button } from "@/componentes/Buttons"
import { criarCheckoutBack, criarCheckoutExpiradoBack } from "@/app/assinatura/actions"

const PLANOS = [
    { ciclo: 'mensal', titulo: 'Mensal', preco: 'R$ 49,90', porMes: null, detalhe: 'cobrado todo mês', destaque: false },
    { ciclo: 'trimestral', titulo: 'Trimestral', preco: 'R$ 134,70', porMes: '≈R$ 44,90/mês', detalhe: 'cobrado a cada 3 meses', destaque: false },
    { ciclo: 'anual', titulo: 'Anual', preco: 'R$ 358,80', porMes: '≈R$ 29,90/mês', detalhe: 'cobrado a cada 12 meses', destaque: true },
] as const

type AssinaturaModalProps = {
    sair: () => void,
    // Presente quando a empresa está com assinatura vencida/inativa e por
    // isso não passou pelo autenticar() normal (ver login/actions.ts).
    billingToken?: string
}

export default function AssinaturaModal({ sair, billingToken }: AssinaturaModalProps) {
    const [carregando, setCarregando] = useState<string | null>(null)

    async function escolher(ciclo: string) {
        setCarregando(ciclo)

        const response = billingToken
            ? await criarCheckoutExpiradoBack(ciclo, billingToken)
            : await criarCheckoutBack(ciclo)

        if (!response.success) {
            setCarregando(null)
            Swal.fire('Opa...', response.error, 'error')
            return
        }

        if (!response.data.url) {
            setCarregando(null)
            Swal.fire('Opa...', 'Erro ao iniciar pagamento.', 'error')
            return
        }

        window.location.href = response.data.url
    }

    return (
        <Cortina onClick={sair}>
            <Container tamanho="mg">
                <Button texto="X" tipo="fechar" tamanho="p" corTexto="branco" onClick={sair} />

                <p className="text-black text-3xl font-bold">Assine o ZentraX</p>
                <p className="text-gray-600 -mt-2">Escolha o ciclo de cobrança:</p>

                <div className="grid gap-4 md:grid-cols-3 w-full pt-2">
                    {PLANOS.map((p) => {
                        const estaCarregando = carregando === p.ciclo
                        const outroCarregando = carregando !== null && !estaCarregando

                        return (
                            <button
                                key={p.ciclo}
                                disabled={carregando !== null}
                                onClick={() => escolher(p.ciclo)}
                                className={`relative flex flex-col items-start text-left rounded-2xl p-5 pt-6
                                transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                                ${p.destaque ? 'bg-cyan-50 border-2 border-cyan-500 shadow-lg shadow-cyan-200' : 'bg-gray-50 border border-gray-300 shadow-md shadow-gray-300'}
                                ${outroCarregando ? 'opacity-40' : 'hover:-translate-y-1 hover:shadow-xl hover:border-cyan-400'}
                                `}
                            >
                                {p.destaque && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow">
                                        Melhor preço
                                    </span>
                                )}

                                <p className="text-marca-700 font-bold text-lg">{p.titulo}</p>

                                <div className="flex items-baseline gap-1 mt-1">
                                    <p className="text-2xl font-semibold tracking-tight text-slate-900 whitespace-nowrap">{p.preco}</p>
                                </div>

                                {p.porMes && (
                                    <p className="text-cyan-700 text-sm font-semibold mt-0.5">{p.porMes}</p>
                                )}

                                <p className="text-gray-500 text-sm mt-2">{p.detalhe}</p>

                                {estaCarregando && (
                                    <div className="flex items-center gap-2 text-marca-700 text-sm mt-3 font-medium">
                                        <span className="h-3.5 w-3.5 rounded-full border-2 border-marca-700 border-t-transparent animate-spin" />
                                        Abrindo pagamento...
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </Container>
        </Cortina>
    )
}
