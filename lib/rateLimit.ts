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

// IP do visitante atrás do nginx. X-Real-IP é definido pelo nginx; o ÚLTIMO item do X-Forwarded-For é o que o
// nginx acrescentou (os anteriores podem ser forjados pelo próprio cliente).
export function ipDoRequest(request: Request): string {
    const real = request.headers.get('x-real-ip')
    if (real) return real.trim()
    const xff = request.headers.get('x-forwarded-for')
    if (xff) return xff.split(',').pop()!.trim()
    return 'desconhecido'
}
