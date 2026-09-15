import { NextResponse } from 'next/server'

// checagem repetida em toda rota /api/admin/* — centralizada aqui pra uma
// rota nova não ter como esquecer dela. Essas rotas dão acesso de leitura E
// escrita a dados de TODAS as empresas (não só a de quem está logado), então
// esquecer essa checagem numa rota nova seria grave. Sem PAINEL_STATS_KEY
// configurada, tudo fica 404 em vez de aberto por engano.
export function erroAutenticacaoPainel(request: Request): NextResponse | null {
    const chave = process.env.PAINEL_STATS_KEY
    if (!chave) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (request.headers.get('x-api-key') !== chave) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    return null
}
