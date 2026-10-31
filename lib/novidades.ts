// "O que tem de novo" do ZentraX. A cada atualização que o cliente PERCEBE, entra um item novo no TOPO da lista
// (o primeiro é sempre o mais recente). O id precisa ser único e nunca mudar: é ele que fica guardado no
// navegador pra saber o que a pessoa já viu. Texto pra lojista: o que mudou pra ele, não o que mudou no código.
export type Novidade = {
    id: string
    data: string // AAAA-MM-DD
    titulo: string
    itens: { titulo: string, texto: string }[]
}

export const NOVIDADES: Novidade[] = [
    {
        id: '2026-10-31-permissoes',
        data: '2026-10-31',
        titulo: 'Permissões dos atendentes',
        itens: [
            { titulo: 'Você decide o que o atendente faz', texto: 'Em Configurações > Conta, marque se os atendentes podem ver relatórios, ver o histórico, desfazer pagamento, excluir cliente ou bloquear fiado.' },
            { titulo: 'QR code das notas opcional', texto: 'Se seus clientes não usam QR code, desligue em Preferências > Comprovante. O papel fica mais curto.' },
        ]
    },
    {
        id: '2026-10-31-pix',
        data: '2026-10-31',
        titulo: 'Pix, lembretes e mais controle',
        itens: [
            { titulo: 'Pix', texto: 'Cadastre a chave Pix em Configurações > Preferências > Pix. O comprovante, a cobrança e o extrato do cliente passam a ter o QR code com o valor que falta.' },
            { titulo: 'Lembrar vencimentos', texto: 'Na tela principal, o botão "Lembrar vencimentos" passa por quem combinou de pagar hoje ou amanhã, com uma mensagem gentil pronta.' },
            { titulo: 'Bloquear fiado', texto: 'Em Editar clientes, marque "Não vender mais fiado". Ao lançar nota pra esse cliente, aparece um aviso vermelho.' },
            { titulo: 'Desfazer pagamento', texto: 'Lançou um pagamento errado? Na aba Pagamentos, o gestor pode desfazer com a senha. O valor volta pras notas.' },
            { titulo: 'Resumo do mês por e-mail', texto: 'Todo dia 1º chega no seu e-mail o resumo do mês anterior. Dá pra desligar em Preferências > Avisos.' },
            { titulo: 'Preferências organizadas', texto: 'As preferências agora são separadas em Avisos, Cobrança, Comprovante, Pix e Dados.' },
        ]
    },
    {
        id: '2026-10-31-comprovante',
        data: '2026-10-31',
        titulo: 'Comprovante mais completo',
        itens: [
            { titulo: 'Saldo anterior', texto: 'O comprovante agora mostra quanto o cliente devia antes, quanto pagou e quanto ficou.' },
            { titulo: 'Notas abatidas', texto: 'Aparece quais notas o pagamento abateu e quanto falta em cada uma.' },
            { titulo: 'QR code do extrato', texto: 'Na via do cliente sai um QR code. Ele aponta a câmera e vê todas as notas dele no celular.' },
            { titulo: 'Logo da loja', texto: 'Coloque a logo em Configurações > Preferências e ela sai no topo do comprovante.' },
        ]
    },
    {
        id: '2026-10-31-clientes',
        data: '2026-10-31',
        titulo: 'Ficha do cliente, relatórios e mais',
        itens: [
            { titulo: 'Cadastro mais completo', texto: 'Agora dá pra colocar apelido, e-mail, endereço, aniversário, limite de fiado e observações no cliente. Tudo opcional, fica em "Mais detalhes".' },
            { titulo: 'Limite de fiado', texto: 'Se uma nota nova passar do limite do cliente, o ZentraX avisa antes de lançar. Não bloqueia, só avisa.' },
            { titulo: 'Resumo do cliente', texto: 'Na ficha tem a aba Resumo: média das últimas notas, quantos dias ele leva pra pagar, quanto comprou no mês e no ano e um gráfico dos últimos 12 meses.' },
            { titulo: 'Relatórios', texto: 'Quem mais pagou, quem mais comprou, melhores pagadores, quem mais deve e clientes que sumiram. Fica no botão Relatórios, só pra gestor.' },
            { titulo: 'Aniversariantes', texto: 'No dia do aniversário o cliente aparece no topo da tela, com o parabéns pronto pra mandar no WhatsApp.' },
            { titulo: 'Link do extrato', texto: 'Na ficha do cliente, o botão "Mandar extrato" gera um link pro cliente ver as notas em aberto pelo celular, sem precisar de login.' },
            { titulo: 'Cobrar atrasados em sequência', texto: 'Um botão passa pelos clientes atrasados um por um, com a mensagem de cobrança pronta. Não precisa abrir ficha por ficha.' },
            { titulo: 'Fechamento do dia', texto: 'Quanto entrou no dia separado por dinheiro, Pix e cartão, pra bater com o caixa.' },
            { titulo: 'Juros por atraso (opcional)', texto: 'Se a sua loja cobra juros, ligue em Configurações > Preferências. O ZentraX mostra o valor com juros na ficha, na cobrança e no extrato do cliente.' },
            { titulo: 'Exportar pra Excel', texto: 'Em Configurações, baixe uma planilha com todos os clientes, notas e pagamentos. Seus dados são seus.' },
        ]
    },
]

export const ULTIMA_NOVIDADE = NOVIDADES[0]?.id ?? ''
