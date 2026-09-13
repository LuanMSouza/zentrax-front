import sgMail from '@sendgrid/mail'

let configurado = false

function garantirConfigurado() {
    if (configurado) return true
    if (!process.env.SENDGRID_API_KEY) return false

    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    configurado = true
    return true
}

type EnviarEmailParams = {
    to: string
    subject: string
    html: string
}

// Enquanto SENDGRID_API_KEY nao estiver no .env, so loga e retorna sucesso:false
// sem lancar erro, pra quem chamar (ex: reset de senha) poder seguir com uma
// mensagem generica pro usuario sem quebrar o fluxo.
export async function enviarEmail({ to, subject, html }: EnviarEmailParams) {
    if (!garantirConfigurado()) {
        console.warn(`[email] SENDGRID_API_KEY não configurado — e-mail para "${to}" não enviado (assunto: "${subject}")`)
        return { success: false, error: 'SendGrid não configurado' }
    }

    try {
        await sgMail.send({
            to,
            from: process.env.SENDGRID_FROM_EMAIL!,
            subject,
            html,
        })
        return { success: true }
    } catch (error) {
        console.error('Erro ao enviar e-mail via SendGrid:', error)
        return { success: false, error: 'Falha ao enviar e-mail' }
    }
}
