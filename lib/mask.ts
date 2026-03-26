export function FormatarValor(valor: number) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

export function formatarDataBR(dataInput: string | Date | null | undefined): string {
    if (!dataInput) return "";

    const data = new Date(dataInput);

    if (isNaN(data.getTime())) {
        return "Data inválida";
    }

    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    });
}