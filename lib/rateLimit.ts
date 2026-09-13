// Rate limit bem simples em memoria - serve pra frear abuso (spam de
// e-mail, brute force leve) num app rodando como processo unico (pm2 fork).
// Reseta ao reiniciar o processo, o que e aceitavel nessa escala.
const ultimaTentativa = new Map<string, number>()

export function podeTentar(chave: string, intervaloMs: number): boolean {
    const agora = Date.now()
    const ultima = ultimaTentativa.get(chave)

    if (ultima && agora - ultima < intervaloMs) {
        return false
    }

    ultimaTentativa.set(chave, agora)

    // Limpeza oportunista pra nao deixar o Map crescer pra sempre.
    if (ultimaTentativa.size > 5000) {
        for (const [k, t] of ultimaTentativa) {
            if (agora - t > intervaloMs) ultimaTentativa.delete(k)
        }
    }

    return true
}
