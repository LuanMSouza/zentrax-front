'use client'

import { ClienteEmAberto } from '@/types'
import { FormatarValor } from '@/lib/mask'

type Situacao = 'vence_hoje' | 'atrasados'

type Props = {
    emAberto: ClienteEmAberto[]
    verTotal: boolean // gestor, ou atendente que o gestor liberou (Configurações > Conta)
    mostrarValores: boolean
    situacao: Situacao | null
    onFiltrar: (s: Situacao | null) => void
}

// O total na rua ficava no FIM da página, depois de todos os cards, e só
// aparecia pro gestor com os valores visíveis. Agora é a primeira coisa da tela.
export default function ResumoTopo({ emAberto, verTotal, mostrarValores, situacao, onFiltrar }: Props) {
    const total = emAberto.reduce((acc, c) => acc + Number(c.total), 0)
    const atrasados = emAberto.filter(c => c.atrasado).length
    const venceHoje = emAberto.filter(c => c.vence_hoje).length

    const itens = [
        // valor financeiro total: gestor, ou atendente liberado
        ...(verTotal
            ? [{ rotulo: 'Total na rua', valor: mostrarValores ? FormatarValor(total) : 'R$ ••••••', destaque: true }]
            : []),
        { rotulo: 'Clientes em aberto', valor: String(emAberto.length), destaque: false },
        { rotulo: 'Vence hoje', valor: String(venceHoje), destaque: false, alerta: venceHoje > 0, filtro: 'vence_hoje' as Situacao },
        { rotulo: 'Atrasados', valor: String(atrasados), destaque: false, alerta: atrasados > 0, filtro: 'atrasados' as Situacao },
    ]

    return (
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {itens.map(i => {
                const filtro = (i as { filtro?: Situacao }).filtro
                const ativo = !!filtro && situacao === filtro
                // card com filtro vira botão: toca de novo pra desligar
                const clique = filtro ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    'aria-pressed': ativo,
                    onClick: () => onFiltrar(ativo ? null : filtro),
                    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFiltrar(ativo ? null : filtro) } },
                } : {}
                return (
                <div
                    key={i.rotulo}
                    {...clique}
                    className={`rounded-2xl px-4 py-3 sm:py-3.5 ${
                        i.destaque ? 'bg-marca-950 text-white col-span-2 md:col-span-1' : ativo ? 'bg-white ring-2 ring-marca-700' : 'bg-white ring-1 ring-slate-900/5'
                    } ${filtro ? 'cursor-pointer hover:ring-marca-700/40 transition-shadow' : ''}`}
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
                )
            })}
        </dl>
    )
}
