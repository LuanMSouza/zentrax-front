// O que o gestor pode liberar pros atendentes (Configurações > Conta). Gestor pode tudo sempre.
// Fica em empresa_settings.permissoes_atendente (jsonb): só as chaves ligadas valem; o resto é "não".
// Pix, juros, usuários, exportar planilha e assinatura continuam só do gestor (não entram aqui).
export const PERMISSOES = {
    relatorios: { rotulo: 'Ver relatórios e o total na rua', descricao: 'Botão Relatórios e o card "Total na rua" da tela principal.' },
    historico: { rotulo: 'Ver o histórico', descricao: 'Botão Histórico, com tudo que cada pessoa fez no sistema.' },
    desfazer: { rotulo: 'Desfazer pagamento', descricao: 'Ícone de desfazer na aba Pagamentos (sempre pede a senha de quem está usando).' },
    excluir: { rotulo: 'Excluir cliente', descricao: 'Apaga o cliente com todas as notas e pagamentos.' },
    bloquear: { rotulo: 'Bloquear fiado de cliente', descricao: '"Não vender mais fiado pra esse cliente" no Editar clientes.' },
} as const

export type Permissao = keyof typeof PERMISSOES
export type MapaPermissoes = Record<Permissao, boolean>

export const LISTA_PERMISSOES = Object.keys(PERMISSOES) as Permissao[]

// jsonb do banco (ou qualquer coisa) → mapa com todas as chaves; só true explícito libera
export function lerPermissoes(valor: unknown): MapaPermissoes {
    const v = (valor && typeof valor === 'object' ? valor : {}) as Record<string, unknown>
    return Object.fromEntries(LISTA_PERMISSOES.map(p => [p, v[p] === true])) as MapaPermissoes
}

export function permissoesDe(role: unknown, doAtendente: unknown): MapaPermissoes {
    if (role === 'gestor') return Object.fromEntries(LISTA_PERMISSOES.map(p => [p, true])) as MapaPermissoes
    return lerPermissoes(doAtendente)
}
