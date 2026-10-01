'use client'

import { useMemo, useState } from "react"
import Swal from "sweetalert2"
import Cortina from "@/componentes/cortina"
import Container from "@/componentes/Container"
import Titulo from "@/componentes/Titulo"
import { Button } from "@/componentes/Buttons"
import { FormatarValor } from "@/lib/mask"
import { lerLista, LIMITE_LINHAS } from "@/lib/importarCaderno"
import { importarCadernoBack } from "./actions"

const EXEMPLO = `Bar do Zé 320
Dona Cida 185,50
Marcos 97
Seu Antônio`

// "Importar do caderno": cola a lista (nome + quanto deve) e cria tudo de uma vez.
// Pensado pra quem está começando com dezenas de clientes no papel.
export default function ImportarCaderno({ sair, concluir }: { sair: () => void; concluir: () => void }) {
    const [texto, setTexto] = useState('')
    const [salvando, setSalvando] = useState(false)

    const linhas = useMemo(() => lerLista(texto), [texto])
    const validas = linhas.filter(l => !l.erro)
    const comValor = validas.filter(l => l.valor)
    const total = comValor.reduce((s, l) => s + (l.valor ?? 0), 0)
    const excedeu = linhas.length > LIMITE_LINHAS

    async function importar() {
        setSalvando(true)
        const r = await importarCadernoBack(texto)
        setSalvando(false)
        if (!r.success) { Swal.fire('Opa...', r.error, 'error'); return }
        await Swal.fire({
            icon: 'success',
            title: 'Pronto!',
            text: `${r.data.novos} ${r.data.novos === 1 ? 'cliente novo' : 'clientes novos'} e ${r.data.notas} ${r.data.notas === 1 ? 'saldo lançado' : 'saldos lançados'} (${FormatarValor(r.data.total)}).`,
        })
        concluir()
        sair()
    }

    return (
        <Cortina onClick={sair}>
            <Container tamanho="mg">
                <Titulo texto="Importar do caderno" cor="preto" />
                <Button tamanho="g" texto="X" tipo="fechar" corTexto="branco" onClick={sair} />

                <p className="text-sm text-slate-600 -mt-1">
                    Um cliente por linha, com o nome e quanto ele deve. Sem valor, o cliente só é cadastrado.
                    Os valores entram como uma nota de <strong>saldo anterior</strong> com a data de hoje.
                </p>

                <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder={EXEMPLO}
                    rows={8}
                    autoFocus
                    aria-label="Lista de clientes"
                    className="w-full rounded-xl ring-1 ring-slate-900/15 focus:ring-2 focus:ring-marca-700 outline-none p-3 text-sm font-mono leading-relaxed resize-y"
                />

                {linhas.length > 0 && (
                    <div className="rounded-xl ring-1 ring-slate-900/10 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0">
                                    <tr><th className="text-left px-3 py-2 font-medium">Cliente</th><th className="text-right px-3 py-2 font-medium">Deve</th></tr>
                                </thead>
                                <tbody>
                                    {linhas.map(l => (
                                        <tr key={l.linha} className="border-t border-slate-100">
                                            <td className="px-3 py-1.5">
                                                {l.nome || <span className="text-slate-400">(linha {l.linha})</span>}
                                                {l.erro && <span className="ml-2 text-xs text-red-600">{l.erro}, será ignorada</span>}
                                            </td>
                                            <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                                                {l.valor ? FormatarValor(l.valor) : <span className="text-slate-400">só cadastro</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-sm flex justify-between gap-3">
                            <span>{validas.length} {validas.length === 1 ? 'cliente' : 'clientes'}</span>
                            <span className="font-semibold">Total: {FormatarValor(total)}</span>
                        </div>
                    </div>
                )}

                {excedeu && <p className="text-sm text-red-600">No máximo {LIMITE_LINHAS} linhas por vez. Divida a lista em partes.</p>}
                <p className="text-xs text-slate-500">Cliente que já existe com o mesmo nome não é duplicado: só recebe o saldo.</p>

                <button
                    onClick={importar}
                    disabled={salvando || !validas.length || excedeu}
                    className="self-center bg-marca-700 hover:bg-marca-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all cursor-pointer"
                >
                    {salvando ? 'Importando...' : validas.length ? `Importar ${validas.length} ${validas.length === 1 ? 'cliente' : 'clientes'}` : 'Importar'}
                </button>
            </Container>
        </Cortina>
    )
}
