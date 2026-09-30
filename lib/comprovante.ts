import { FormatarValor, formatarDataBR } from "@/lib/mask";

type ComprovanteProps = {
    empresa: string,
    cliente: string,
    valor: number,
    saldoRestante?: number, // sem ele o comprovante não fala de saldo nem de quitação
    atendente?: string,
    // reimpressão (aba Pagamentos): sai com a tarja REIMPRESSÃO e a data do pagamento original. Sem saldo, porque o
    // saldo de hoje não é o que o cliente tinha no dia.
    reimpressaoDe?: Date | string
}

// nomes de empresa/cliente vêm do usuário e vão pra dentro de um HTML montado na mão
function escapar(texto: string) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Imprime pelo diálogo de impressão do próprio navegador, num iframe escondido (pra não imprimir a tela do sistema
// junto). Funciona com qualquer térmica instalada como impressora no computador, sem driver nem biblioteca: a largura
// não é fixa, o texto se ajusta à bobina (58mm ou 80mm) que a impressora informar.
export function imprimirComprovante({ empresa, cliente, valor, saldoRestante, atendente, reimpressaoDe }: ComprovanteProps) {
    const agora = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const temSaldo = saldoRestante !== undefined;
    const quitado = temSaldo && saldoRestante < 0.01;

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Comprovante de pagamento</title>
<style>
    @page { margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    /* térmica só tem preto: nada de cinza, que sai falhado */
    body { max-width: 80mm; padding: 4mm 4mm 8mm; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
    .centro { text-align: center; }
    .empresa { font-size: 16px; font-weight: 700; text-transform: uppercase; overflow-wrap: anywhere; }
    .titulo { margin-top: 1mm; font-size: 11px; letter-spacing: 1px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 3mm 0; }
    .linha { display: flex; justify-content: space-between; gap: 3mm; }
    .linha span:last-child { text-align: right; overflow-wrap: anywhere; }
    .rotulo { margin-top: 1mm; font-size: 11px; }
    .valor { font-size: 24px; font-weight: 700; line-height: 1.2; }
    .quitado { display: inline-block; margin-top: 2mm; padding: 1mm 3mm; border: 1.5px solid #000; font-weight: 700; letter-spacing: 1px; }
    .reimpressao { margin-bottom: 3mm; padding: 1mm 0; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; font-weight: 700; letter-spacing: 2px; }
    .rodape { margin-top: 1mm; font-size: 11px; }
</style>
</head>
<body>
    ${reimpressaoDe ? '<p class="centro reimpressao">REIMPRESSÃO</p>' : ''}
    <p class="centro empresa">${escapar(empresa)}</p>
    <p class="centro titulo">COMPROVANTE DE PAGAMENTO</p>
    <hr>
    <p class="linha"><span>Cliente</span><span><b>${escapar(cliente)}</b></span></p>
    ${reimpressaoDe
            ? `<p class="linha"><span>Pago em</span><span>${formatarDataBR(reimpressaoDe)}</span></p>
    <p class="linha"><span>Reimpresso em</span><span>${agora}</span></p>`
            : `<p class="linha"><span>Data</span><span>${agora}</span></p>`}
    <hr>
    <div class="centro">
        <p class="rotulo">VALOR PAGO</p>
        <p class="valor">${FormatarValor(valor)}</p>
        ${quitado ? '<p class="quitado">QUITADO</p>' : ''}
    </div>
    <hr>
    ${temSaldo && !quitado ? `<p class="linha"><span>Saldo em aberto</span><span><b>${FormatarValor(saldoRestante)}</b></span></p>` : ''}
    ${atendente ? `<p class="linha"><span>Atendente</span><span>${escapar(atendente)}</span></p>` : ''}
    ${(temSaldo && !quitado) || atendente ? '<hr>' : ''}
    <p class="centro rodape">Obrigado pela preferência!</p>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.srcdoc = html;

    iframe.onload = () => {
        const janela = iframe.contentWindow;
        if (!janela) return;
        janela.onafterprint = () => iframe.remove();
        janela.focus();
        janela.print();
    };

    document.body.appendChild(iframe);
}
