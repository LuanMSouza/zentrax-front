import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'
import { codigoValido, registrarIndicacao } from '@/lib/indicacao'
import { DIAS_TRIAL } from '@/lib/trial'
import { permitir } from '@/lib/rateLimit'

// Endpoint publico chamado pela LP (lp-zentrax/app/cadastro/actions.ts) pra
// criar conta nova a partir do teste gratis. Sem autenticacao por design -
// e o cadastro de quem ainda nao tem conta.

// mesmo topico ntfy que o leads-back ja usa pros avisos do painel (bot
// bloqueado, sessao concluida etc) - cadastro novo cai no mesmo lugar que o
// Luan ja acompanha, sem precisar abrir o painel toda hora pra saber se
// alguem se cadastrou. Best-effort: nunca pode derrubar o cadastro em si.
async function notificarNovoCadastro(nomeEmpresa: string, segmento: string) {
    const topic = process.env.NTFY_TOPIC
    if (!topic) return
    try {
        await fetch(`https://ntfy.sh/${topic}`, {
            method: 'POST',
            headers: { Title: 'Novo cadastro no ZentraX', Priority: 'default', Tags: 'tada' },
            body: `${nomeEmpresa} (${segmento}) acabou de criar conta - teste gratis de ${DIAS_TRIAL} dias.`,
        })
    } catch (err) {
        console.error('Falha ao notificar novo cadastro via ntfy:', err)
    }
}

// o leads-back já tem a conta Brevo do ZentraX (mesma do convite frio, com
// margem reservada na rampa de aquecimento pra transacional como esse) e toda
// a infra de template/envio pronta — mais simples chamar de lá do que duplicar
// isso aqui. Mesma chave compartilhada que o painel já usa pra chamar pra cá
// (LEADS_BACK_URL/PAINEL_STATS_KEY viram ZENTRAX_API_URL/ZENTRAX_API_KEY do
// lado de lá), só que na direção inversa. Best-effort: nunca pode derrubar o
// cadastro em si.
async function enviarBoasVindas(nome: string, email: string, nomeResponsavel: string, whatsapp: string) {
    const url = process.env.LEADS_BACK_URL
    const chave = process.env.PAINEL_STATS_KEY
    if (!url || !chave) return
    try {
        await fetch(`${url}/api/zentrax-boas-vindas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': chave },
            body: JSON.stringify({ nome, email, nomeResponsavel, whatsapp }),
        })
    } catch (err) {
        console.error('Falha ao disparar e-mail de boas-vindas:', err)
    }
}

const ORIGENS_PERMITIDAS = [
    'https://zentrax.dvls.com.br',
    'http://localhost:3000',
]

function corsHeaders(origin: string | null) {
    const allowOrigin = origin && ORIGENS_PERMITIDAS.includes(origin) ? origin : ORIGENS_PERMITIDAS[0]
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
}

export async function OPTIONS(request: Request) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })
}

export async function POST(request: Request) {
    const headers = corsHeaders(request.headers.get('origin'))

    // Endpoint público. O formulário da LP envia do SERVIDOR da Vercel, então o IP que chega aqui é o da Vercel (não o
    // do visitante) e um limite por IP bloquearia todo mundo — o limite por visitante fica na LP. Aqui vai só um teto
    // GLOBAL, pra um ataque direto não criar contas em série nem usar o e-mail de boas-vindas pra mandar mensagem
    // a terceiros. Volume real é baixo; ajuste se o lançamento passar de 40 cadastros por hora.
    if (!permitir('onboarding:global:h', 40, 60 * 60 * 1000) || !permitir('onboarding:global:m', 8, 60 * 1000)) {
        return NextResponse.json({ error: 'Muitos cadastros no momento. Tente de novo em alguns minutos.' }, { status: 429, headers })
    }

    try {
        const body = await request.json().catch(() => null)

        const nome = String(body?.nome ?? '').trim()
        const nomeResponsavel = String(body?.nomeResponsavel ?? '').trim()
        const usuario = String(body?.usuario ?? '').trim().toLowerCase()
        const email = String(body?.email ?? '').trim().toLowerCase()
        const senha = String(body?.senha ?? '')
        const segmento = body?.segmento === 'pet' ? 'pet' : 'geral'
        // WhatsApp é opcional (pra você chamar a pessoa e ajudar a começar): só dígitos, 10 a 13
        const whatsappBruto = String(body?.whatsapp ?? '').replace(/\D/g, '')
        const whatsapp = whatsappBruto.length >= 10 && whatsappBruto.length <= 13 ? whatsappBruto : ''
        const codigoIndicacao = codigoValido(body?.ref)

        if (!nome || !nomeResponsavel || !usuario || !email || !senha) {
            return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400, headers })
        }

        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!EMAIL_REGEX.test(email)) {
            return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400, headers })
        }

        if (senha.length < 6) {
            return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400, headers })
        }

        const usuarioExiste = await prisma.usuarios.findFirst({
            where: {
                OR: [
                    { usuario: { equals: usuario, mode: 'insensitive' } },
                    { email: { equals: email, mode: 'insensitive' } },
                ]
            }
        })

        if (usuarioExiste) {
            return NextResponse.json({ error: 'Esse usuário ou e-mail já está em uso.' }, { status: 409, headers })
        }

        const senhaHash = await bcrypt.hash(senha, 10)

        const novaEmpresaId = await prisma.$transaction(async (tx) => {
            const novaEmpresa = await tx.empresa.create({
                data: {
                    nome,
                    segmento,
                    status: 'ativo',
                    plano: 'basico',
                    // teste gratis, igual anunciado na LP (DIAS_TRIAL em lib/trial.ts)
                    data_expiracao: new Date(Date.now() + DIAS_TRIAL * 24 * 60 * 60 * 1000),
                }
            })

            // Sem isso, a empresa fica sem configuracoes (bug ja visto em
            // producao antes: empresa cadastrada sem settings vinculada).
            await tx.empresa_settings.create({
                data: { empresa_id: novaEmpresa.id }
            })

            await tx.usuarios.create({
                data: {
                    nome: nomeResponsavel,
                    usuario,
                    email,
                    senha: senhaHash,
                    empresa_id: novaEmpresa.id,
                    role: 'gestor',
                }
            })

            return novaEmpresa.id
        })

        // indicação é best-effort: código errado/teto/qualquer falha aqui nunca
        // pode impedir o cadastro de quem acabou de criar a conta
        if (codigoIndicacao) {
            registrarIndicacao(codigoIndicacao, novaEmpresaId, email)
                .catch((err) => console.error('Falha ao registrar indicação:', err))
        }

        // o leads-back já manda o push (com WhatsApp e origem do convite); este só cobre a falta dele
        if (!process.env.LEADS_BACK_URL) notificarNovoCadastro(nome, segmento).catch(() => {})
        enviarBoasVindas(nome, email, nomeResponsavel, whatsapp).catch(() => {})

        return NextResponse.json({ success: true }, { status: 201, headers })

    } catch (error) {
        console.error('Erro no onboarding publico:', error)
        return NextResponse.json({ error: 'Erro interno ao criar a conta.' }, { status: 500, headers })
    }
}
