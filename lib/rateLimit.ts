// Limitador simples em memória (o app roda num processo só, via PM2 em fork — não há vários workers pra dividir o
// contador). Reinicia junto com o app, o que é aceitável pra este uso (proteger endpoints públicos de abuso).
const janelas = new Map<string, number[]>()

// true = pode seguir; false = passou do limite dentro da janela
export function permitir(chave: string, max: number, janelaMs: number): boolean {
    const agora = Date.now()
    const recentes = (janelas.get(chave) ?? []).filter(t => agora - t < janelaMs)
    if (recentes.length >= max) {
        janelas.set(chave, recentes)
        return false
    }
    recentes.push(agora)
    janelas.set(chave, recentes)

    // limpeza ocasional pra o mapa não crescer sem fim
    if (janelas.size > 5000) {
        for (const [k, v] of janelas) if (v.every(t => agora - t >= janelaMs)) janelas.delete(k)
    }
    return true
}

// IP do visitante atrás do nginx (rotas /api e /adm). Mesma regra do ipDosHeaders() abaixo: só o X-Real-IP, que o
// nginx sobrescreve. O X-Forwarded-For não entra porque, enquanto o nginx não o define, o próprio cliente escolhe.
export function ipDoRequest(request: Request): string {
    return ipDosHeaders(request.headers)
}

export function estourou(chave: string, max: number, janelaMs: number): boolean {
    const agora = Date.now()
    const recentes = (janelas.get(chave) ?? []).filter(t => agora - t < janelaMs)
    janelas.set(chave, recentes)
    return recentes.length >= max
}

export function anotarFalha(chave: string) {
    const lista = janelas.get(chave) ?? []
    lista.push(Date.now())
    janelas.set(chave, lista)
}

export function esquecer(chave: string) {
    janelas.delete(chave)
}

// IP do visitante dentro de uma Server Action (headers() do Next). Só é confiável quando o nginx SOBRESCREVE o
// X-Real-IP com $remote_addr (ver qa/INFRA-PARA-O-LUAN.md) e o Next escuta só em 127.0.0.1; sem isso devolve
// 'desconhecido' e quem chama não deve limitar por IP (senão todo mundo cai no mesmo balde).
export function ipDosHeaders(h: Headers): string {
    const real = h.get('x-real-ip')
    return real ? real.trim().slice(0, 64) : 'desconhecido'
}
