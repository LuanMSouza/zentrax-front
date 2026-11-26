import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { LP_URL, comissaoMensal, fimDaComissao, situacaoDaEmpresa, type Situacao } from "@/lib/parceiros";
import { formatarDataBR } from "@/lib/mask";
import CopiarLink from "./CopiarLink";

// Página PÚBLICA (fora do middleware de login), protegida pelo token secreto do parceiro na URL, no mesmo molde do
// extrato. Mostra só as empresas indicadas por ele: nome, data, situação da assinatura e comissão estimada.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Painel do parceiro',
    robots: { index: false, follow: false },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const ROTULO: Record<Situacao, { texto: string, classe: string }> = {
    ativa: { texto: 'Assinatura ativa', classe: 'bg-emerald-100 text-emerald-700' },
    teste: { texto: 'Em teste grátis', classe: 'bg-blue-100 text-blue-700' },
    teste_expirado: { texto: 'Teste expirado', classe: 'bg-slate-100 text-slate-600' },
    cancelada: { texto: 'Assinatura cancelada', classe: 'bg-red-100 text-red-700' },
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

export default async function PainelParceiro({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    let tokenLimpo = ''
    try { tokenLimpo = decodeURIComponent(token) } catch { tokenLimpo = '' }
    if (!/^[a-f0-9]{36}$/.test(tokenLimpo)) {
        return <Aviso titulo="Link inválido" texto="Confira o link que você recebeu ou fale com a ZentraX." />
    }

    const parceiro = await prisma.parceiros.findUnique({
        where: { token: tokenLimpo },
        include: {
            empresas: {
                orderBy: { created_at: 'desc' },
                select: { id: true, nome: true, created_at: true, status: true, data_expiracao: true, stripe_subscription_id: true, stripe_ciclo: true },
            },
        },
    })
    if (!parceiro || !parceiro.ativo) {
        return <Aviso titulo="Link inválido" texto="Confira o link que você recebeu ou fale com a ZentraX." />
    }

    const agora = new Date()
    const linhas = parceiro.empresas.map(e => {
        const situacao = situacaoDaEmpresa(e, agora)
        const fim = fimDaComissao(e.created_at, parceiro.meses)
        const comissionavel = situacao === 'ativa' && !!fim && fim > agora
        return {
            id: e.id, nome: e.nome, cadastradaEm: e.created_at, situacao, ciclo: e.stripe_ciclo, fim, comissionavel,
            comissao: comissionavel ? comissaoMensal(e.stripe_ciclo, parceiro.percentual) : 0,
        }
    })
    const ativas = linhas.filter(l => l.situacao === 'ativa').length
    const emTeste = linhas.filter(l => l.situacao === 'teste').length
    const totalMensal = Math.round(linhas.reduce((a, l) => a + l.comissao, 0) * 100) / 100
    const link = `${LP_URL}?ref=${parceiro.codigo}`

    return (
        <main className="min-h-dvh bg-slate-50 p-4 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <header>
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Programa de parceiros ZentraX</p>
                    <h1 className="text-2xl font-semibold text-slate-900 mt-1">Olá, {parceiro.nome}</h1>
                    <p className="text-slate-600 mt-1">Você recebe {parceiro.percentual}% do valor pago por cada indicado, por {parceiro.meses} meses.</p>
                </header>

                <section className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                        <p className="text-xs text-slate-500">Assinaturas ativas</p>
                        <p className="text-2xl font-semibold text-emerald-600">{ativas}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                        <p className="text-xs text-slate-500">Em teste grátis</p>
                        <p className="text-2xl font-semibold text-blue-600">{emTeste}</p>
                    </div>
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                        <p className="text-xs text-slate-500">Comissão estimada/mês</p>
                        <p className="text-2xl font-semibold text-slate-900">{brl(totalMensal)}</p>
                    </div>
                </section>

                <section className="rounded-xl bg-white border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Seu link de indicação</p>
                    <CopiarLink link={link} />
                </section>

                <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                    <h2 className="px-4 pt-4 text-sm font-semibold text-slate-900">Empresas indicadas ({linhas.length})</h2>
                    {linhas.length === 0 ? (
                        <p className="p-4 text-sm text-slate-500">Ninguém criou conta pelo seu link ainda. Compartilhe o link acima.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 mt-3">
                            {linhas.map(l => (
                                <li key={l.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-900 truncate">{l.nome}</p>
                                        <p className="text-xs text-slate-500">
                                            Cadastro em {l.cadastradaEm ? formatarDataBR(l.cadastradaEm) : '-'}
                                            {l.comissionavel && l.fim ? ` · comissão até ${formatarDataBR(l.fim)}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {l.comissionavel && <span className="text-sm font-semibold text-slate-900">{brl(l.comissao)}/mês</span>}
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROTULO[l.situacao].classe}`}>{ROTULO[l.situacao].texto}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <p className="text-xs text-slate-500">
                    A comissão é estimada pelo valor de tabela do plano e paga por Pix uma vez por mês, depois da confirmação do pagamento do cliente.
                    O valor final acompanha o que o cliente realmente pagou.
                </p>
            </div>
        </main>
    )
}
