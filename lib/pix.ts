// Pix "copia e cola" (BR Code estático, padrão EMV do Banco Central), sem biblioteca.
// O mesmo texto vira QR code: qualquer app de banco lê e já preenche chave, nome e valor.
// Vale pra tela e pro servidor.

export type ConfigPix = { chave: string, nome: string, cidade: string }

// Nome e cidade no BR Code: sem acento, maiúsculo e com limite de tamanho (25 e 15)
function limpar(texto: string, max: number) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim().toUpperCase().slice(0, max)
}

// Chave como o banco espera: CPF/CNPJ só dígitos, e-mail minúsculo, celular com +55, aleatória como veio
export function normalizarChavePix(chave: string) {
    const c = chave.trim()
    if (c.includes('@')) return c.toLowerCase()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase()
    if (c.startsWith('+')) return '+' + c.replace(/\D/g, '')
    const digitos = c.replace(/\D/g, '')
    // CPF formatado (000.000.000-00) ou CNPJ: só os dígitos
    if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(c) || digitos.length === 14) return digitos
    // celular com DDD sem +55: 11 dígitos com 9 depois do DDD (ex.: 13 99999-8888) e escrito com espaço, parêntese ou traço
    if (digitos.length === 11 && /[\s()-]/.test(c) && digitos[2] === '9') return `+55${digitos}`
    return c
}

export function chavePixValida(chave: string) {
    const c = normalizarChavePix(chave)
    return /^\d{11}$/.test(c) || /^\d{14}$/.test(c) || /^\+\d{12,13}$/.test(c)
        || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) || /^[0-9a-f-]{36}$/.test(c)
}

function campo(id: string, valor: string) {
    return id + String(valor.length).padStart(2, '0') + valor
}

// CRC16-CCITT (polinômio 0x1021, começa em 0xFFFF), exigido no fim do BR Code
function crc16(texto: string) {
    let crc = 0xFFFF
    for (const byte of new TextEncoder().encode(texto)) {
        crc ^= byte << 8
        for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
    return crc.toString(16).toUpperCase().padStart(4, '0')
}

// valor em reais (opcional): sem valor, o cliente digita quanto vai pagar no app do banco
export function codigoPix(config: ConfigPix, valor?: number | null) {
    const corpo = [
        campo('00', '01'),
        campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', normalizarChavePix(config.chave))),
        campo('52', '0000'),
        campo('53', '986'),
        valor && valor > 0 ? campo('54', valor.toFixed(2)) : '',
        campo('58', 'BR'),
        campo('59', limpar(config.nome, 25) || 'LOJA'),
        campo('60', limpar(config.cidade, 15) || 'BRASIL'),
        campo('62', campo('05', '***')),
        '6304',
    ].join('')
    return corpo + crc16(corpo)
}

// O que vem do banco vira config, ou null se a loja não configurou o Pix
export function configPixDe(s: { pix_chave?: string | null, pix_nome?: string | null, pix_cidade?: string | null } | null | undefined): ConfigPix | null {
    if (!s?.pix_chave || !chavePixValida(s.pix_chave)) return null
    return { chave: s.pix_chave, nome: s.pix_nome ?? '', cidade: s.pix_cidade ?? '' }
}
