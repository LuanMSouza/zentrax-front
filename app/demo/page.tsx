'use client'

import { useEffect, useState } from 'react'
import { entrarDemo } from './actions'

// /demo: entra direto na empresa de exemplo (link "Ver demonstração" da LP).
export default function Demo() {
    const [erro, setErro] = useState<string | null>(null)

    useEffect(() => {
        // conta a visita no analytics único do painel de leads (site 'zentrax-app'), com a
        // origem (?utm_source=lp|email|whatsapp, ?lid= do convite) — fire-and-forget, nunca
        // trava a entrada. Envio único (sem os sinais de tempo/rolagem): a página só redireciona.
        // text/plain: o navegador manda pra outro domínio sem pergunta prévia de CORS
        try {
            const q = new URLSearchParams(window.location.search)
            navigator.sendBeacon?.('https://api.leads.dvls.com.br/api/inbound/pageview', new Blob([JSON.stringify({
                site: 'zentrax-app', path: '/demo', referrer: document.referrer || null,
                utmSource: q.get('utm_source'), utmMedium: q.get('utm_medium'), utmCampaign: q.get('utm_campaign'),
                lead: q.get('lid'), leadNoLink: !!q.get('lid'),
            })], { type: 'text/plain' }))
        } catch { /* sem analytics, segue */ }

        entrarDemo().then(r => {
            if (!r.success) { setErro(r.error); return }
            localStorage.clear()
            localStorage.setItem('empresa', JSON.stringify(r.data.empresa))
            localStorage.setItem('usuario', JSON.stringify(r.data.usuario))
            localStorage.setItem('settings', JSON.stringify(r.data.settings))
            window.location.replace('/dashboard')
        }).catch(() => setErro('Não foi possível abrir a demonstração.'))
    }, [])

    return (
        <main className="min-h-screen bg-marca-950 flex items-center justify-center px-6 text-center">
            <div>
                <img src="/Logo.png" alt="" className="h-14 mx-auto mb-6" />
                <p className="text-white text-lg font-semibold">{erro ?? 'Abrindo a demonstração...'}</p>
                {!erro && <p className="text-slate-300 text-sm mt-2">Dados fictícios, pode mexer à vontade.</p>}
            </div>
        </main>
    )
}
