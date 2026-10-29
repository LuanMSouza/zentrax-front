export type Cliente = {
    id: number,
    nome: string,
    whatsapp: string | bigint | null,
    documento: string | null
}

export type Pagamentos = {
    id: number;
    id_cliente: number;
    data: Date | string;
    valor: number;
    empresa_id: number | null;
    nota_abatida: number;
    quantidade?: number;
    recibo?: Recibo | null; // null nos pagamentos de antes do comprovante numerado
    clientes: Cliente
};

export type Recibo = {
    numero: number;
    criadoEm: string; // ISO
    forma: string;
    valor: number;
    saldoApos: number;
    atendente: string | null;
}

export type Notas = {
    id: number,
    id_cliente: number | null,
    valor_inicial: number,
    valor_abatido: number,
    data: Date | string,
    empresa_id: number,
    descricao: string | null,
    quantidade: number,
    valor_extra: number,
    segmento: string,
    valor_unitario: number,
    vencimento: Date | string | null
}

export type ClienteEmAberto = {
    id: number;
    nome: string;
    total: string;
    quantidade_de_notas: number;
    mais_nova: string;
    mais_antiga: string;
    // menor data combinada entre as notas em aberto (null = nenhuma nota tem data combinada)
    proximo_vencimento: string | null;
    // tem nota vencida: passou da data combinada, ou (sem data combinada) já tem 30 dias
    atrasado: boolean;
    vence_hoje: boolean;
}
