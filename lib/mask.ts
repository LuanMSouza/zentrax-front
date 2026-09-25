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

// dias corridos desde uma data (só-data, UTC, igual formatarDataBR). null se a
// data for inválida ou absurda (o banco tem uma nota de 0001-01-01 por erro antigo)
export function diasDesde(dataInput: string | Date | null | undefined): number | null {
    if (!dataInput) return null;
    const t = new Date(dataInput).getTime();
    if (isNaN(t)) return null;
    const dias = Math.floor((Date.now() - t) / 86_400_000);
    return dias < 0 || dias > 36_500 ? null : dias;
}
