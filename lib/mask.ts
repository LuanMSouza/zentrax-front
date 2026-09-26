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


// "hoje" no Brasil como data (00:00 UTC do dia de Brasília), pra gravar em colunas @db.Date. `new Date()` cru gravava o
// dia em UTC: um pagamento feito depois das 21h de Brasília ficava com a data de amanhã.
export function hojeBR(): Date {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()); // YYYY-MM-DD
    return new Date(`${dia}T00:00:00.000Z`);
}
