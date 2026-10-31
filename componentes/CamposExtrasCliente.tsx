'use client'

import { MESES } from "@/lib/cliente"

// Estado do formulário: tudo string (é o que o input devolve). A validação de verdade é no servidor (lerCamposExtras).
export type FormExtras = {
    apelido: string
    email: string
    endereco: string
    aniversario_dia: string
    aniversario_mes: string
    observacoes: string
    limite_fiado: string
}

export const EXTRAS_VAZIOS: FormExtras = {
    apelido: '', email: '', endereco: '', aniversario_dia: '', aniversario_mes: '', observacoes: '', limite_fiado: ''
}

export function extrasDoCliente(c: Partial<Record<keyof FormExtras, unknown>>): FormExtras {
    return {
        apelido: String(c.apelido ?? ''),
        email: String(c.email ?? ''),
        endereco: String(c.endereco ?? ''),
        aniversario_dia: c.aniversario_dia ? String(c.aniversario_dia) : '',
        aniversario_mes: c.aniversario_mes ? String(c.aniversario_mes) : '',
        observacoes: String(c.observacoes ?? ''),
        limite_fiado: c.limite_fiado ? String(c.limite_fiado).replace('.', ',') : '',
    }
}

type Props = {
    valor: FormExtras
    onChange: (v: FormExtras) => void
    abertoDeInicio?: boolean
    solto?: boolean // sem a caixa de abrir/fechar (no Editar clientes os campos ficam sempre à mostra)
}

export const campo = "w-full bg-white rounded-lg ring-1 ring-slate-900/10 px-3.5 py-2.5 text-base text-left placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-marca-700 transition-shadow"
export const rotulo = "flex flex-col gap-1.5 text-sm font-medium text-slate-700"

// "Mais detalhes (opcional)", fechado por padrão: o cadastro do dia a dia continua só nome e WhatsApp.
export default function CamposExtrasCliente({ valor, onChange, abertoDeInicio = false, solto = false }: Props) {
    const mudar = (k: keyof FormExtras) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        onChange({ ...valor, [k]: e.target.value })

    const campos = (
        <div className={`grid gap-4 sm:grid-cols-2 ${solto ? '' : 'px-4 pb-4'}`}>
            <label className={rotulo}>
                Apelido
                <input value={valor.apelido} onChange={mudar('apelido')} maxLength={60} placeholder="ex.: Zé da oficina" className={campo} />
            </label>
            <label className={rotulo}>
                E-mail
                <input type="email" value={valor.email} onChange={mudar('email')} maxLength={120} placeholder="ex.: maria@gmail.com" className={campo} />
            </label>
            <label className={`${rotulo} sm:col-span-2`}>
                Endereço
                <input value={valor.endereco} onChange={mudar('endereco')} maxLength={160} placeholder="Rua, número, bairro" className={campo} />
            </label>
            <div className={rotulo}>
                Aniversário
                <div className="flex gap-2">
                    <select value={valor.aniversario_dia} onChange={mudar('aniversario_dia')} aria-label="Dia do aniversário" className={`${campo} cursor-pointer`}>
                        <option value="">Dia</option>
                        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                    <select value={valor.aniversario_mes} onChange={mudar('aniversario_mes')} aria-label="Mês do aniversário" className={`${campo} cursor-pointer`}>
                        <option value="">Mês</option>
                        {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                </div>
            </div>
            <label className={rotulo}>
                Limite de fiado (R$)
                <input inputMode="decimal" value={valor.limite_fiado} onChange={mudar('limite_fiado')} placeholder="ex.: 300,00" className={campo} />
                <span className="text-xs font-normal text-slate-500">Avisa ao lançar uma nota que passe disso. Não bloqueia.</span>
            </label>
            <label className={`${rotulo} sm:col-span-2`}>
                Observações
                <textarea value={valor.observacoes} onChange={mudar('observacoes')} maxLength={500} rows={3}
                    placeholder="ex.: só paga depois do dia 5, filho do seu Zé" className={`${campo} resize-y`} />
            </label>
        </div>
    )

    if (solto) return campos

    return (
        <details open={abertoDeInicio} className="w-full group rounded-xl ring-1 ring-slate-900/10 bg-slate-50/60">
            <summary className="cursor-pointer select-none list-none px-4 py-3 text-sm font-medium text-slate-700 flex items-center justify-between">
                Mais detalhes (opcional)
                <span className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
            </summary>
            {campos}
        </details>
    )
}
