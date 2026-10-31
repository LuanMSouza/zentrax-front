'use client'

import { useEffect, useState } from 'react'
import Cortina from '@/componentes/cortina'
import Container from '@/componentes/Container'
import Titulo from '@/componentes/Titulo'
import { Button } from '@/componentes/Buttons'
import { NOVIDADES, ULTIMA_NOVIDADE } from '@/lib/novidades'
import { formatarDataBR } from '@/lib/mask'

const CHAVE = 'novidadeVista'

// O "visto" fica no navegador (sem banco): quem usa no celular e no PC vê a janela uma vez em cada.
function lerVista() {
    try { return localStorage.getItem(CHAVE) } catch { return null }
}
function marcarVista() {
    try { localStorage.setItem(CHAVE, ULTIMA_NOVIDADE) } catch { }
}

// Botão "Novidades" na barra do topo. Com coisa nova que a pessoa ainda não viu: bolinha no botão e a janela abre
// sozinha uma vez. Na demonstração pública não abre sozinha (atrapalharia quem está conhecendo o app).
export default function Novidades({ demo }: { demo: boolean }) {
    const [aberto, setAberto] = useState(false)
    const [temNova, setTemNova] = useState(false)

    useEffect(() => {
        if (!ULTIMA_NOVIDADE || lerVista() === ULTIMA_NOVIDADE) return
        setTemNova(true)
        if (!demo) setAberto(true)
    }, [demo])

    function fechar() {
        marcarVista()
        setTemNova(false)
        setAberto(false)
    }

    return (
        <>
            <button
                onClick={() => setAberto(true)}
                aria-label={temNova ? 'Novidades (tem coisa nova)' : 'Novidades'}
                title="Novidades"
                className="relative flex items-center gap-1.5 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
                </svg>
                <span className="hidden lg:inline text-sm">Novidades</span>
                {temNova && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-marca-950" />}
            </button>

            {aberto && (
                <Cortina onClick={fechar}>
                    <Container tamanho="m">
                        <Button onClick={fechar} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />
                        <div className="pr-10">
                            <Titulo texto="O que tem de novo" cor="preto" />
                            <p className="text-sm text-slate-500 mt-0.5">As últimas mudanças no ZentraX.</p>
                        </div>

                        <div className="flex flex-col gap-6 max-h-[60dvh] overflow-y-auto -mx-1 px-1">
                            {NOVIDADES.map((n, i) => (
                                <section key={n.id} className={i > 0 ? 'border-t border-slate-100 pt-5' : ''}>
                                    <p className="text-xs font-medium text-slate-400">{formatarDataBR(n.data)}</p>
                                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">{n.titulo}</h3>
                                    <ul className="mt-3 flex flex-col gap-3">
                                        {n.itens.map(item => (
                                            <li key={item.titulo} className="flex gap-3">
                                                <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full bg-marca-700 shrink-0" />
                                                <p className="text-sm text-slate-600">
                                                    <span className="font-medium text-slate-900">{item.titulo}.</span> {item.texto}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>

                        <button onClick={fechar}
                            className="self-end px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-marca-700 hover:bg-marca-800 cursor-pointer transition-colors">
                            Entendi
                        </button>
                    </Container>
                </Cortina>
            )}
        </>
    )
}
