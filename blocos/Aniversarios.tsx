'use client'

import Swal from 'sweetalert2'
import { Cliente } from '@/types'
import { linkWhatsApp } from '@/lib/mask'

// "Aniversário hoje" no topo do dashboard, com o parabéns pronto pro WhatsApp. Só aparece quando tem alguém.
// Dia/mês de hoje no fuso de Brasília (perto da meia-noite o UTC já seria amanhã).
function hojeDiaMes() {
    const [, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-')
    return { dia: Number(dia), mes: Number(mes) }
}

export default function Aniversarios({ clientes }: { clientes: Cliente[] }) {
    const { dia, mes } = hojeDiaMes()
    // 29/02 em ano que não é bissexto: comemora no dia 28
    const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
    const vale29 = mes === 2 && dia === 28 && !ehBissexto(new Date().getFullYear())

    const hoje = clientes.filter(c =>
        c.aniversario_mes === mes && (c.aniversario_dia === dia || (vale29 && c.aniversario_dia === 29)))
    if (hoje.length === 0) return null

    async function parabens(c: Cliente) {
        let loja = ''
        try { loja = JSON.parse(localStorage.getItem('empresa') ?? '{}')?.nome ?? '' } catch { }
        const primeiroNome = c.nome.trim().split(/\s+/)[0]
        const mensagem = `Feliz aniversário, ${primeiroNome}!! Muita saúde e felicidade pra você. Um abraço${loja ? ` de todos da ${loja}` : ''}!`

        if (c.whatsapp) {
            window.open(linkWhatsApp(String(c.whatsapp), mensagem), '_blank')
            return
        }
        await navigator.clipboard.writeText(mensagem)
        Swal.fire('Copiado!', 'Esse cliente não tem WhatsApp cadastrado. A mensagem foi copiada.', 'success')
    }

    return (
        <section className="rounded-2xl bg-fuchsia-50 ring-1 ring-fuchsia-600/15 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm font-medium text-fuchsia-900">
                <span aria-hidden>🎂</span> Aniversário hoje
            </p>
            <ul className="flex flex-wrap gap-2">
                {hoje.map(c => (
                    <li key={c.id} className="flex items-center gap-2 bg-white rounded-full ring-1 ring-fuchsia-600/15 pl-3 pr-1 py-1">
                        <span className="text-sm text-slate-800">{c.nome}</span>
                        <button onClick={() => parabens(c)}
                            className="text-xs font-semibold bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-full px-3 py-1 cursor-pointer transition-colors">
                            Dar parabéns
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}
