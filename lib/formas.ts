// Formas de pagamento aceitas ao registrar um pagamento. A chave vai pro banco (recibos.forma), o texto é o que
// aparece na tela e no comprovante.
export const FORMAS = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    debito: 'Débito',
    credito: 'Crédito',
    pix_direto: 'Pix direto'
} as const

export type Forma = keyof typeof FORMAS

export function formaValida(forma: unknown): forma is Forma {
    return typeof forma === 'string' && Object.hasOwn(FORMAS, forma)
}

export function nomeForma(forma: string | null | undefined) {
    return formaValida(forma) ? FORMAS[forma] : (forma ?? '')
}
