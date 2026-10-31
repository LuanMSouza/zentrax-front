import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { lerTokenExtrato } from "@/lib/linkExtrato";
import { FormatarValor, formatarDataBR } from "@/lib/mask";
import { nomeForma } from "@/lib/formas";
import { configJurosDe, jurosDaNota } from "@/lib/juros";

// Página PÚBLICA (fora do middleware de login): o cliente da loja abre pelo link que recebeu no WhatsApp.
// Mostra só o que é dele: notas em aberto e os últimos pagamentos. Nada de outros clientes, nada de valores da loja.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Extrato',
    robots: { index: false, follow: false },
}

function Aviso({ titulo, texto }: { titulo: string, texto: string }) {
    return (
        <main className="min-h-dvh bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
                <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
                <p className="mt-2 text-slate-600">{texto}</p>
            </div>
        </main>
    )
}

export default async function ExtratoPublico({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const clienteId = lerTokenExtrato(decodeURIComponent(token))
    if (!clienteId) {
        return <Aviso titulo="Link expirado" texto="Esse link não vale mais. Peça um novo pra loja." />
    }

    const cliente = await prisma.clientes.findUnique({
        where: { id: clienteId },
        select: {
            nome: true,
            empresa: { select: { nome: true, status: true, empresa_settings: { select: { telefone: true, endereco: true, juros_ativo: true, juros_mes: true, multa_atraso: true, juros_carencia: true } } } },
        }
    })
    if (!cliente || cliente.empresa?.status !== 'ativo') {
        return <Aviso titulo="Extrato indisponível" texto="Não encontramos esse extrato. Fale com a loja." />
    }

    const [notas, recibos, agora] = await Promise.all([
        prisma.$queryRaw<{ id: number, data: Date, descricao: string | null, valor_inicial: string, valor_abatido: string, vencimento: Date | null }[]>`
            SELECT id, data, descricao, valor_inicial, valor_abatido, vencimento
            FROM pedidos
            WHERE id_cliente = ${clienteId} AND COALESCE(valor_inicial, 0) - COALESCE(valor_abatido, 0) > 0
            ORDER BY data ASC, id ASC
        `,
        prisma.recibos.findMany({
            where: { id_cliente: clienteId },
            orderBy: { criado_em: 'desc' },
            take: 5,
            select: { id: true, valor: true, forma: true, criado_em: true }
        }),
        Promise.resolve(new Date()),
    ])

    const saldo = (n: typeof notas[number]) => Number(n.valor_inicial) - Number(n.valor_abatido)
    const total = notas.reduce((acc, n) => acc + saldo(n), 0)
    const configJuros = configJurosDe(cliente.empresa?.empresa_settings)
    const loja = cliente.empresa?.nome ?? ''
    const contato = [cliente.empresa?.empresa_settings?.telefone, cliente.empresa?.empresa_settings?.endereco].filter(Boolean).join(' · ')
    const quando = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(agora)
    const hojeISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
    const juros = new Map(notas.map(n => [n.id, jurosDaNota(saldo(n), n, configJuros, hojeISO)]))
    const totalJuros = [...juros.values()].reduce((acc, j) => acc + j.valor, 0)

    return (
        <main className="min-h-dvh bg-slate-50">
            <div className="max-w-lg mx-auto px-4 py-8 sm:py-12 flex flex-col gap-5">
                <header>
                    <p className="text-sm font-medium text-marca-700">{loja}</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-1">Extrato de {cliente.nome}</h1>
                    {contato && <p className="text-sm text-slate-500 mt-1">{contato}</p>}
                </header>

                <section className="rounded-2xl bg-marca-950 text-white px-5 py-4">
                    <p className="text-sm text-slate-300">{total > 0 ? 'Total em aberto' : 'Situação'}</p>
                    <p className="text-3xl font-semibold tabular-nums mt-1">{total > 0 ? FormatarValor(total) : 'Tudo pago'}</p>
                    {total > 0 && <p className="text-sm text-slate-300 mt-1">{notas.length} {notas.length === 1 ? 'nota em aberto' : 'notas em aberto'}</p>}
                    {totalJuros > 0 && (
                        <p className="text-sm text-amber-300 mt-2 pt-2 border-t border-white/10">
                            Com juros e multa por atraso: <span className="font-semibold tabular-nums">{FormatarValor(total + totalJuros)}</span>
                        </p>
                    )}
                </section>

                {notas.length > 0 && (
                    <section>
                        <h2 className="text-sm font-medium text-slate-700 mb-2">Notas em aberto</h2>
                        <ul className="flex flex-col gap-2">
                            {notas.map(n => {
                                const venc = n.vencimento ? new Date(n.vencimento).toISOString().slice(0, 10) : null
                                const atrasada = !!venc && venc < hojeISO
                                return (
                                    <li key={n.id} className="rounded-xl bg-white ring-1 ring-slate-900/5 px-4 py-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-900">{formatarDataBR(n.data)}</p>
                                            {n.descricao && <p className="text-sm text-slate-600 break-words">{n.descricao}</p>}
                                            {Number(n.valor_abatido) > 0 && (
                                                <p className="text-xs text-slate-500 mt-0.5">Nota de {FormatarValor(Number(n.valor_inicial))}, já pagou {FormatarValor(Number(n.valor_abatido))}</p>
                                            )}
                                            {venc && (
                                                <p className={`text-xs mt-0.5 ${atrasada ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                                                    {atrasada ? 'Venceu em' : 'Combinado pra'} {formatarDataBR(n.vencimento)}
                                                </p>
                                            )}
                                            {(juros.get(n.id)?.valor ?? 0) > 0 && (
                                                <p className="text-xs text-amber-700 mt-0.5">+ {FormatarValor(juros.get(n.id)!.valor)} de juros ({juros.get(n.id)!.dias} dias de atraso)</p>
                                            )}
                                        </div>
                                        <p className="text-base font-semibold tabular-nums text-slate-900 shrink-0">{FormatarValor(saldo(n))}</p>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )}

                {recibos.length > 0 && (
                    <section>
                        <h2 className="text-sm font-medium text-slate-700 mb-2">Últimos pagamentos</h2>
                        <ul className="rounded-xl bg-white ring-1 ring-slate-900/5 divide-y divide-slate-100">
                            {recibos.map(r => (
                                <li key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                                    <span className="text-slate-600">
                                        {new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(r.criado_em)}
                                        <span className="text-slate-400"> · {nomeForma(r.forma)}</span>
                                    </span>
                                    <span className="font-medium tabular-nums text-emerald-700">{FormatarValor(Number(r.valor))}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <footer className="text-xs text-slate-400 text-center pt-2">
                    <p>Atualizado em {quando}. Alguma dúvida? Fale com a loja.</p>
                    <p className="mt-1">Feito com <a href="https://zentrax.dvls.com.br/?utm_source=extrato&utm_medium=link" className="underline underline-offset-2">ZentraX</a></p>
                </footer>
            </div>
        </main>
    )
}
