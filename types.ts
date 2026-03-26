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
    clientes: Cliente
};

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
    valor_unitario: number
}

export type ClienteEmAberto = {
    id: number;
    nome: string;
    total: string;
    quantidade_de_notas: number;
    mais_nova: string;
    mais_antiga: string;
}
