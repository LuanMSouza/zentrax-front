'use client'

import { useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import { Button } from "@/componentes/Buttons"
import { criarCheckoutBack, criarCheckoutExpiradoBack } from "@/app/assinatura/actions"

const PLANOS = [
    { ciclo: 'mensal', titulo: 'Mensal', preco: 'R$ 49,90', detalhe: 'cobrado todo mês' },
    { ciclo: 'trimestral', titulo: 'Trimestral', preco: 'R$ 134,70', detalhe: 'a cada 3 meses (≈R$44,90/mês)' },
    { ciclo: 'anual', titulo: 'Anual', preco: 'R$ 358,80', detalhe: 'a cada 12 meses (≈R$29,90/mês) — melhor preço' },
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
            <Container tamanho="m">
                <Button texto="X" tipo="fechar" tamanho="p" corTexto="branco" onClick={sair} />

                <p className="text-black text-3xl font-bold">Assine o ZentraX</p>
                <p className="text-gray-600 -mt-2">Escolha o ciclo de cobrança:</p>

                <div className="grid gap-3 md:grid-cols-3 w-full">
                    {PLANOS.map((p) => (
                        <button
                            key={p.ciclo}
                            disabled={carregando !== null}
                            onClick={() => escolher(p.ciclo)}
                            className="border-2 border-blue-500 hover:bg-blue-50 active:scale-95 transition-all rounded-lg p-4 text-left disabled:opacity-50 cursor-pointer"
                        >
                            <p className="text-blue-600 font-bold text-lg">{p.titulo}</p>
                            <p className="text-2xl font-extrabold text-gray-900">{p.preco}</p>
                            <p className="text-gray-500 text-sm">{p.detalhe}</p>
                            {carregando === p.ciclo && <p className="text-blue-500 text-sm mt-2">Abrindo pagamento...</p>}
                        </button>
                    ))}
                </div>
            </Container>
        </Cortina>
    )
}
