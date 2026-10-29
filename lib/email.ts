import { Resend } from 'resend'

// Mesmo cuidado do lib/stripe.ts: inicialização preguiçosa pra não derrubar
// o build em ambientes sem RESEND_API_KEY configurada ainda.
let resendSingleton: Resend | null = null

function getResend(): Resend {
    if (!resendSingleton) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY não configurada.')
        }
        resendSingleton = new Resend(process.env.RESEND_API_KEY)
    }
    return resendSingleton
}

// Antes do domínio mail.zentrax.dvls.com.br estar verificado no Resend, só
// dá pra mandar pro próprio e-mail dono da conta Resend, usando o remetente
// padrão deles. Troca RESEND_FROM depois de verificar o domínio.
const FROM = process.env.RESEND_FROM ?? 'ZentraX <onboarding@resend.dev>'

export async function enviarEmailRecuperacaoSenha(destinatario: string, link: string) {
    const resend = getResend()

    const { error } = await resend.emails.send({
        from: FROM,
        to: destinatario,
        subject: 'Recuperação de senha - ZentraX',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Redefinir sua senha</h2>
                <p>Recebemos um pedido pra redefinir a senha da sua conta no ZentraX.</p>
                <p>
                    <a href="${link}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Redefinir senha
                    </a>
                </p>
                <p style="color: #666; font-size: 14px;">Esse link expira em 1 hora. Se você não pediu isso, pode ignorar esse e-mail.</p>
            </div>
        `
    })

    if (error) {
        throw new Error(`Falha ao enviar e-mail via Resend: ${error.message}`)
    }
}

type ItemVencimento = { nome: string, valor: string }

const escapar = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const lista = (itens: ItemVencimento[]) =>
    `<ul style="padding-left: 18px; margin: 4px 0 16px;">${itens.map(i => `<li>${escapar(i.nome)}: ${i.valor}</li>`).join('')}</ul>`

// Aviso da manhã pro dono da loja: quem vence hoje e quem venceu ontem sem pagar (ver app/api/admin/avisar-vencimentos).
export async function enviarEmailVencimentos(destinatario: string, nomeResponsavel: string, venceHoje: ItemVencimento[], venceuOntem: ItemVencimento[], link: string) {
    const resend = getResend()

    const plural = (n: number) => `${n} ${n === 1 ? 'cliente' : 'clientes'}`
    const subject = venceHoje.length
        ? `Hoje vence o fiado de ${plural(venceHoje.length)}`
        : `${plural(venceuOntem.length)} não ${venceuOntem.length === 1 ? 'pagou' : 'pagaram'} no dia combinado`

    const { error } = await resend.emails.send({
        from: FROM,
        to: destinatario,
        subject,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
                <p>Oi, ${escapar(nomeResponsavel.split(' ')[0])}!</p>
                ${venceHoje.length ? `<p style="margin-bottom: 0;"><strong>Vence hoje:</strong></p>${lista(venceHoje)}` : ''}
                ${venceuOntem.length ? `<p style="margin-bottom: 0;"><strong>Venceu ontem e ainda não foi pago:</strong></p>${lista(venceuOntem)}` : ''}
                <p>
                    <a href="${link}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                        Abrir o ZentraX
                    </a>
                </p>
                <p style="color: #666; font-size: 13px;">Esse e-mail só chega nos dias em que algum fiado vence. Pra não receber mais, desliga em Configurações › Preferências.</p>
            </div>
        `
    })

    if (error) {
        throw new Error(`Falha ao enviar e-mail via Resend: ${error.message}`)
    }
}
