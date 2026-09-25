'use client'

import { ClienteEmAberto } from '@/types'
import { FormatarValor, diasDesde } from '@/lib/mask'

type Props = {
    emAberto: ClienteEmAberto[]
    role: string | null
    mostrarValores: boolean
}

// O total na rua ficava no FIM da página, depois de todos os cards, e só
// aparecia pro gestor com os valores visíveis. Agora é a primeira coisa da tela.
export default function ResumoTopo({ emAberto, role, mostrarValores }: Props) {
    const total = emAberto.reduce((acc, c) => acc + Number(c.total), 0)
    const atrasados = emAberto.filter(c => (diasDesde(c.mais_antiga) ?? 0) >= 30).length

    const itens = [
        // valor financeiro total: só gestor (regra que já existia)
        ...(role === 'gestor'
            ? [{ rotulo: 'Total na rua', valor: mostrarValores ? FormatarValor(total) : 'R$ ••••••', destaque: true }]
            : []),
        { rotulo: 'Clientes em aberto', valor: String(emAberto.length), destaque: false },
        { rotulo: 'Atrasados (+30 dias)', valor: String(atrasados), destaque: false, alerta: atrasados > 0 },
    ]

    return (
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {itens.map(i => (
                <div
                    key={i.rotulo}
                    className={`rounded-2xl px-4 py-3 sm:py-3.5 ${
                        i.destaque ? 'bg-marca-950 text-white col-span-2 md:col-span-1' : 'bg-white ring-1 ring-slate-900/5'
                    }`}
                >
                    <dt className={`text-xs ${i.destaque ? 'text-slate-300' : 'text-slate-500'}`}>{i.rotulo}</dt>
                    <dd
                        className={`mt-0.5 sm:mt-1 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums ${
                            i.destaque ? 'text-white' : (i as { alerta?: boolean }).alerta ? 'text-amber-600' : 'text-slate-900'
                        }`}
                    >
                        {i.valor}
                    </dd>
                </div>
            ))}
        </dl>
    )
}
