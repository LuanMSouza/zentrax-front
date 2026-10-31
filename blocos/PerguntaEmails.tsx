'use client'

import { useEffect, useState } from 'react'
import { perguntaEmailsBack, responderEmailsBack } from '@/app/dashboard/actions'

// Card que aparece uma vez pro gestor: quer receber os e-mails da loja? Só depois do "sim" eles começam a sair.
// "Agora não" também conta como resposta (some e não volta); dá pra mudar depois em Preferências > Avisos.
export default function PerguntaEmails() {
    const [email, setEmail] = useState<string | null>(null)
    const [resposta, setResposta] = useState<'sim' | 'nao' | null>(null)

    useEffect(() => {
        perguntaEmailsBack().then(r => setEmail(r?.email ?? null)).catch(() => {})
    }, [])

    async function responder(quer: boolean) {
        setResposta(quer ? 'sim' : 'nao')
        await responderEmailsBack(quer).catch(() => {})
    }

    if (!email) return null

    if (resposta) {
        return (
            <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 px-4 py-3 text-sm text-slate-600">
                {resposta === 'sim'
                    ? <>Combinado!! Os e-mails vão pra <span className="font-medium text-slate-900">{email}</span>.</>
                    : 'Tudo bem, você não vai receber e-mails.'} Dá pra mudar quando quiser em Configurações › Preferências › Avisos.
            </section>
        )
    }

    return (
        <section className="rounded-2xl bg-white ring-1 ring-slate-900/5 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">Quer receber avisos por e-mail?</p>
                <p className="text-sm text-slate-500 mt-0.5">
                    De manhã, quando um fiado vence ou atrasa, e todo dia 1º o resumo do mês. Vai pra <span className="text-slate-700 break-all">{email}</span>.
                </p>
            </div>
            <div className="flex gap-2 shrink-0">
                <button onClick={() => responder(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 ring-1 ring-slate-900/10 hover:bg-slate-50 cursor-pointer transition-colors">
                    Agora não
                </button>
                <button onClick={() => responder(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-marca-700 hover:bg-marca-800 cursor-pointer transition-colors">
                    Quero receber
                </button>
            </div>
        </section>
    )
}
