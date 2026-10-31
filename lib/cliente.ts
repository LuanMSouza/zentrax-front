// Campos opcionais do cadastro do cliente (apelido, e-mail, endereço, aniversário, observações, limite de fiado).
// Um lugar só pra validar, usado no criar e no editar: o que vier vazio vira null, o que vier errado vira erro.

export type CamposExtras = {
    apelido: string | null
    email: string | null
    endereco: string | null
    aniversario_dia: number | null
    aniversario_mes: number | null
    observacoes: string | null
    limite_fiado: number | null
}

export type EntradaExtras = Partial<Record<keyof CamposExtras, unknown>>

const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function texto(v: unknown, max: number) {
    const t = String(v ?? '').trim().replace(/\s+/g, ' ')
    return t ? t.slice(0, max) : null
}

export function lerCamposExtras(e: EntradaExtras): { ok: true, campos: CamposExtras } | { ok: false, error: string } {
    const email = texto(e.email, 120)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'O e-mail parece incompleto.' }

    const dia = Number(e.aniversario_dia) || null
    const mes = Number(e.aniversario_mes) || null
    // só dia ou só mês não serve pra nada: guarda os dois ou nenhum
    if (!!dia !== !!mes) return { ok: false, error: 'No aniversário, escolha o dia e o mês.' }
    if (dia && mes && (mes < 1 || mes > 12 || dia < 1 || dia > DIAS_NO_MES[mes - 1])) {
        return { ok: false, error: 'Esse dia não existe nesse mês.' }
    }

    // aceita "1.500,50", "1500,50" e "1500.50"
    const limiteTxt = String(e.limite_fiado ?? '').trim()
    let limite: number | null = null
    if (limiteTxt) {
        const normalizado = limiteTxt.includes(',') ? limiteTxt.replace(/\./g, '').replace(',', '.') : limiteTxt
        limite = Number(normalizado.replace(/[^\d.]/g, ''))
        if (!Number.isFinite(limite) || limite <= 0) return { ok: false, error: 'O limite de fiado precisa ser um valor maior que zero.' }
        if (limite >= 100_000_000) return { ok: false, error: 'O limite de fiado está alto demais.' }
        limite = Number(limite.toFixed(2))
    }

    return {
        ok: true,
        campos: {
            apelido: texto(e.apelido, 60),
            email: email?.toLowerCase() ?? null,
            endereco: texto(e.endereco, 160),
            aniversario_dia: dia,
            aniversario_mes: mes,
            // observação pode ter quebra de linha: não junta os espaços
            observacoes: String(e.observacoes ?? '').trim().slice(0, 500) || null,
            limite_fiado: limite,
        }
    }
}

// Linha do banco → formato que vai pro navegador (Decimal não atravessa a Server Action).
export function extrasParaTela(c: Partial<Record<keyof CamposExtras, unknown>>) {
    return {
        apelido: (c.apelido as string | null) ?? null,
        email: (c.email as string | null) ?? null,
        endereco: (c.endereco as string | null) ?? null,
        aniversario_dia: c.aniversario_dia != null ? Number(c.aniversario_dia) : null,
        aniversario_mes: c.aniversario_mes != null ? Number(c.aniversario_mes) : null,
        observacoes: (c.observacoes as string | null) ?? null,
        limite_fiado: c.limite_fiado != null ? Number(c.limite_fiado) : null,
    }
}

export const SELECT_EXTRAS = {
    apelido: true, email: true, endereco: true, aniversario_dia: true, aniversario_mes: true, observacoes: true, limite_fiado: true
} as const

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function textoAniversario(dia: number | null | undefined, mes: number | null | undefined) {
    return dia && mes ? `${dia} de ${MESES[mes - 1]}` : null
}

// Busca que acha pelo nome ou pelo apelido, sem ligar pra acento nem maiúscula ("jose" acha "José").
export function semAcento(t: string) {
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function bateBusca(c: { nome: string, apelido?: string | null }, busca: string) {
    if (!busca) return true
    const b = semAcento(busca)
    return semAcento(c.nome).includes(b) || (!!c.apelido && semAcento(c.apelido).includes(b))
}

// Selo de pagador pela média de dias entre a nota e o pagamento que a quitou (últimas 10 notas quitadas). Só com 3+
// notas medidas, pra um cliente novo não ganhar rótulo por causa de uma nota só. O corte de 30 dias é o mesmo da regra
// de "atrasado" das notas sem data combinada.
export function seloPagador(mediaDias: number | null | undefined, notasMedidas: number | null | undefined) {
    if (mediaDias == null || !notasMedidas || notasMedidas < 3) return null
    if (mediaDias <= 10) return { rotulo: 'paga rápido', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' }
    if (mediaDias <= 30) return { rotulo: 'paga em dia', cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' }
    return { rotulo: 'demora pra pagar', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
}

// Cliente que comprava com frequência (no máximo a cada 30 dias) e já ficou 3x esse tempo sem aparecer (mínimo 15
// dias, pra quem compra todo dia não virar "sumido" num fim de semana).
export function estaSumido(intervaloMedio: number | null | undefined, diasSemComprar: number | null | undefined) {
    if (intervaloMedio == null || diasSemComprar == null) return false
    return intervaloMedio <= 30 && diasSemComprar >= Math.max(3 * intervaloMedio, 15)
}

export function textoFrequencia(intervaloMedio: number | null | undefined) {
    if (intervaloMedio == null) return null
    const d = Math.max(1, Math.round(intervaloMedio))
    if (d === 1) return 'quase todo dia'
    if (d === 7) return 'toda semana'
    return `a cada ${d} dias`
}
