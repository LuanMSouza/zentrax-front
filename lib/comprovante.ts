import Swal from "sweetalert2";
import { FormatarValor, formatarDataBR } from "@/lib/mask";

export type Via = 'cliente' | 'loja'

type ComprovanteProps = {
    empresa: string,
    cliente: string,
    valor: number,
    vias: Via[], // uma cópia por via, cada uma identificada no topo
    saldoRestante?: number, // sem ele o comprovante não fala de saldo nem de quitação
    atendente?: string,
    // reimpressão (aba Pagamentos): sai com a tarja REIMPRESSÃO e a data do pagamento original. O saldo, se vier, é o
    // de hoje (não o do dia do pagamento) e sai rotulado assim.
    reimpressaoDe?: Date | string
}

type ExtratoProps = {
    empresa: string,
    cliente: string,
    notas: {
        data: Date | string,
        descricao: string | null,
        valorInicial: number,
        valorAbatido: number
    }[]
}

const NOME_VIA: Record<Via, string> = { cliente: 'VIA DO CLIENTE', loja: 'VIA DA LOJA' }
const CHAVE_VIAS = 'comprovanteVias'

// nomes de empresa/cliente vêm do usuário e vão pra dentro de um HTML montado na mão
function escapar(texto: string) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function agoraBR() {
    return new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Imprime pelo diálogo de impressão do próprio navegador, num iframe escondido (pra não imprimir a tela do sistema
// junto). Funciona com qualquer térmica instalada como impressora no computador, sem driver nem biblioteca: a largura
// não é fixa, o texto se ajusta à bobina (58mm ou 80mm) que a impressora informar. Cada item de `paginas` sai numa
// página própria, que na térmica vira um cupom separado (com corte, se a impressora cortar).
function imprimir(titulo: string, paginas: string[]) {
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<style>
    @page { margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    /* térmica só tem preto: nada de cinza, que sai falhado */
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; color: #000; }
    section { max-width: 80mm; padding: 4mm 4mm 8mm; break-after: page; }
    section:last-child { break-after: auto; }
    .centro { text-align: center; }
    .empresa { font-size: 16px; font-weight: 700; text-transform: uppercase; overflow-wrap: anywhere; }
    .titulo { margin-top: 1mm; font-size: 11px; letter-spacing: 1px; }
    .via { margin-top: 1mm; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 3mm 0; }
    .linha { display: flex; justify-content: space-between; gap: 3mm; }
    .linha span:last-child { text-align: right; overflow-wrap: anywhere; }
    .rotulo { margin-top: 1mm; font-size: 11px; }
    .valor { font-size: 24px; font-weight: 700; line-height: 1.2; }
    .quitado { display: inline-block; margin-top: 2mm; padding: 1mm 3mm; border: 1.5px solid #000; font-weight: 700; letter-spacing: 1px; }
    .reimpressao { margin-bottom: 3mm; padding: 1mm 0; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; font-weight: 700; letter-spacing: 2px; }
    .nota { margin-bottom: 2mm; break-inside: avoid; }
    .detalhe { font-size: 11px; overflow-wrap: anywhere; }
    .total { font-size: 15px; font-weight: 700; }
    .rodape { margin-top: 1mm; font-size: 11px; }
</style>
</head>
<body>
${paginas.map(p => `<section>${p}</section>`).join('\n')}
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

export function imprimirComprovante({ empresa, cliente, valor, vias, saldoRestante, atendente, reimpressaoDe }: ComprovanteProps) {
    const agora = agoraBR();
    const temSaldo = saldoRestante !== undefined;
    // o selo só vale na hora do pagamento: numa reimpressão o saldo zerado de hoje não quer dizer que foi
    // aquele pagamento que quitou
    const quitado = temSaldo && !reimpressaoDe && saldoRestante < 0.01;

    const paginas = vias.map(via => `
    ${reimpressaoDe ? '<p class="centro reimpressao">REIMPRESSÃO</p>' : ''}
    <p class="centro empresa">${escapar(empresa)}</p>
    <p class="centro titulo">COMPROVANTE DE PAGAMENTO</p>
    <p class="centro via">${NOME_VIA[via]}</p>
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
    ${temSaldo && !quitado ? `<p class="linha"><span>${reimpressaoDe ? 'Saldo em aberto hoje' : 'Saldo em aberto'}</span><span><b>${FormatarValor(saldoRestante)}</b></span></p>` : ''}
    ${atendente ? `<p class="linha"><span>Atendente</span><span>${escapar(atendente)}</span></p>` : ''}
    ${(temSaldo && !quitado) || atendente ? '<hr>' : ''}
    <p class="centro rodape">Obrigado pela preferência!</p>`);

    imprimir('Comprovante de pagamento', paginas);
}

// Extrato do que o cliente deve: uma linha por nota em aberto (da mais antiga pra mais nova) e o total.
export function imprimirExtrato({ empresa, cliente, notas }: ExtratoProps) {
    const emAberto = notas
        .map(n => ({ ...n, saldo: n.valorInicial - n.valorAbatido }))
        .filter(n => n.saldo > 0)
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    const total = emAberto.reduce((acc, n) => acc + n.saldo, 0);

    const linhas = emAberto.map(n => `
    <div class="nota">
        <p class="linha"><span>${formatarDataBR(n.data)}</span><span><b>${FormatarValor(n.saldo)}</b></span></p>
        ${n.descricao ? `<p class="detalhe">${escapar(n.descricao)}</p>` : ''}
        ${n.valorAbatido > 0 ? `<p class="detalhe">Nota de ${FormatarValor(n.valorInicial)}, já pago ${FormatarValor(n.valorAbatido)}</p>` : ''}
    </div>`).join('');

    imprimir('Extrato do cliente', [`
    <p class="centro empresa">${escapar(empresa)}</p>
    <p class="centro titulo">NOTAS EM ABERTO</p>
    <hr>
    <p class="linha"><span>Cliente</span><span><b>${escapar(cliente)}</b></span></p>
    <p class="linha"><span>Emitido em</span><span>${agoraBR()}</span></p>
    <hr>
    ${emAberto.length === 0 ? '<p class="centro">Nenhuma nota em aberto.</p>' : linhas}
    <hr>
    <p class="linha"><span>Notas em aberto</span><span>${emAberto.length}</span></p>
    <p class="linha total"><span>TOTAL</span><span>${FormatarValor(total)}</span></p>
    <hr>
    <p class="centro rodape">Obrigado pela preferência!</p>`]);
}

// Pergunta se imprime e quais vias. Devolve as vias marcadas, ou null se a pessoa fechou sem imprimir. A última
// escolha fica guardada no navegador, pra quem sempre imprime só uma via não ter que desmarcar toda vez.
export async function perguntarVias({ titulo, texto, sucesso = false }: { titulo: string, texto?: string, sucesso?: boolean }): Promise<Via[] | null> {
    let salvas: Via[] = ['cliente', 'loja'];
    try {
        const lidas = JSON.parse(localStorage.getItem(CHAVE_VIAS) ?? 'null');
        if (Array.isArray(lidas) && lidas.length > 0) salvas = lidas;
    } catch { /* valor salvo inválido: fica no padrão */ }

    const caixa = (via: Via, rotulo: string) => `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="via-${via}" ${salvas.includes(via) ? 'checked' : ''} style="width:18px;height:18px;">
            ${rotulo}
        </label>`;

    const result = await Swal.fire({
        title: titulo,
        icon: sucesso ? 'success' : undefined,
        html: `
            ${texto ? `<p>${escapar(texto)}</p>` : ''}
            <div style="display:flex;flex-direction:column;gap:8px;width:fit-content;margin:16px auto 0;text-align:left;">
                ${caixa('cliente', 'Via do cliente')}
                ${caixa('loja', 'Via da loja')}
            </div>`,
        showCancelButton: true,
        confirmButtonText: 'Imprimir comprovante',
        confirmButtonColor: '#3C32E6',
        cancelButtonText: 'Fechar',
        preConfirm: () => {
            const vias = (['cliente', 'loja'] as Via[]).filter(via =>
                (document.getElementById(`via-${via}`) as HTMLInputElement | null)?.checked
            );
            if (vias.length === 0) {
                Swal.showValidationMessage('Marque pelo menos uma via pra imprimir.');
                return false;
            }
            return vias;
        }
    });

    if (!result.isConfirmed || !result.value) return null;

    const vias = result.value as Via[];
    try { localStorage.setItem(CHAVE_VIAS, JSON.stringify(vias)); } catch { /* sem storage: só não lembra */ }
    return vias;
}
