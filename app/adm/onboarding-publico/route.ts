import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import prisma from '@/lib/prisma'

// Endpoint publico chamado pela LP (lp-zentrax/app/cadastro/actions.ts) pra
// criar conta nova a partir do teste gratis. Sem autenticacao por design -
// e o cadastro de quem ainda nao tem conta.

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

    try {
        const body = await request.json().catch(() => null)

        const nome = String(body?.nome ?? '').trim()
        const nomeResponsavel = String(body?.nomeResponsavel ?? '').trim()
        const usuario = String(body?.usuario ?? '').trim().toLowerCase()
        const email = String(body?.email ?? '').trim().toLowerCase()
        const senha = String(body?.senha ?? '')
        const segmento = body?.segmento === 'pet' ? 'pet' : 'geral'

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

        await prisma.$transaction(async (tx) => {
            const novaEmpresa = await tx.empresa.create({
                data: {
                    nome,
                    segmento,
                    status: 'ativo',
                    plano: 'basico',
                    // 7 dias de teste gratis, igual anunciado na LP
                    data_expiracao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
        })

        return NextResponse.json({ success: true }, { status: 201, headers })

    } catch (error) {
        console.error('Erro no onboarding publico:', error)
        return NextResponse.json({ error: 'Erro interno ao criar a conta.' }, { status: 500, headers })
    }
}
