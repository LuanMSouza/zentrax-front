import Swal from "sweetalert2";
import { FormatarValor, formatarDataBR, linkWhatsApp } from "@/lib/mask";
import { nomeForma } from "@/lib/formas";
import { pegarCabecalhoComprovanteBack } from "@/app/dashboard/actions";

export type Via = 'cliente' | 'loja'

// O que um comprovante diz, seja no papel ou no WhatsApp.
export type DadosComprovante = {
    cliente: string,
    valor: number,
    numero?: number,
    forma?: string,
    atendente?: string | null,
    dataHora?: string, // momento do pagamento (ISO). Sem ela e sem `dia`, vale agora.
    dia?: Date | string, // pagamento antigo, de antes do recibo numerado: só se sabe o dia
    saldo?: number, // sem ele o comprovante não fala de saldo nem de quitação
    saldoDeHoje?: boolean, // o saldo é o de hoje, não o de logo depois do pagamento (pagamento antigo)
    reimpressao?: boolean // sai com a tarja REIMPRESSÃO e a data em que foi reimpresso
}

type ExtratoProps = {
    cliente: string,
    notas: {
        data: Date | string,
        descricao: string | null,
        valorInicial: number,
        valorAbatido: number
    }[]
}

type Cabecalho = {
    nome: string,
    cnpj: string | null,
    telefone: string | null,
    endereco: string | null,
    rodape: string | null
}

const NOME_VIA: Record<Via, string> = { cliente: 'VIA DO CLIENTE', loja: 'VIA DA LOJA' }
const CHAVE_VIAS = 'comprovanteVias'
const RODAPE_PADRAO = 'Obrigado pela preferência!'

// Dados da loja pro topo do comprovante. Busca uma vez e guarda enquanto a página estiver aberta;
// esquecerCabecalho() é chamado quando as preferências são salvas.
let cabecalhoGuardado: Promise<Cabecalho> | null = null

function cabecalho(): Promise<Cabecalho> {
    if (!cabecalhoGuardado) {
        cabecalhoGuardado = pegarCabecalhoComprovanteBack()
            .then(res => {
                if (res.success && res.data) return res.data;
                throw new Error(res.error);
            })
            .catch(() => {
                // sem os dados do servidor, imprime só com o nome que o login guardou, e tenta de novo na próxima
                cabecalhoGuardado = null;
                let nome = '';
                try { nome = JSON.parse(localStorage.getItem('empresa') ?? '{}')?.nome ?? ''; } catch { /* fica sem nome */ }
                return { nome, cnpj: null, telefone: null, endereco: null, rodape: null };
            });
    }
    return cabecalhoGuardado;
}

export function esquecerCabecalho() {
    cabecalhoGuardado = null;
}

// nomes de empresa/cliente vêm do usuário e vão pra dentro de um HTML montado na mão
function escapar(texto: string) {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function dataHoraBR(data: Date | string = new Date()) {
    return new Date(data).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function numeroRecibo(numero: number) {
    return String(numero).padStart(6, '0');
}

function quandoFoiPago(dados: DadosComprovante) {
    if (dados.dataHora) return dataHoraBR(dados.dataHora);
    if (dados.dia) return formatarDataBR(dados.dia);
    return dataHoraBR();
}

// O selo só vale quando o saldo é o de logo depois do pagamento: num pagamento antigo, o saldo zerado de hoje não
// quer dizer que foi aquele pagamento que quitou.
function quitou(dados: DadosComprovante) {
    return dados.saldo !== undefined && !dados.saldoDeHoje && dados.saldo < 0.01;
}

function htmlCabecalho(cab: Cabecalho) {
    return `
    <p class="centro empresa">${escapar(cab.nome)}</p>
    ${cab.cnpj ? `<p class="centro loja">CNPJ ${cab.cnpj}</p>` : ''}
    ${cab.endereco ? `<p class="centro loja">${escapar(cab.endereco)}</p>` : ''}
    ${cab.telefone ? `<p class="centro loja">${escapar(cab.telefone)}</p>` : ''}`;
}

// Imprime pelo diálogo de impressão do próprio navegador, num iframe escondido (pra não imprimir a tela do sistema
// junto). Funciona com qualquer térmica instalada como impressora no computador, sem driver nem biblioteca: a largura
// não é fixa, o texto se ajusta à bobina (58mm ou 80mm) que a impressora informar. A promise resolve quando o diálogo
// de impressão fecha (imprimindo ou cancelando).
function imprimir(titulo: string, corpo: string): Promise<void> {
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
    section { max-width: 80mm; padding: 4mm 4mm 8mm; }
    .centro { text-align: center; }
    .empresa { font-size: 16px; font-weight: 700; text-transform: uppercase; overflow-wrap: anywhere; }
    .loja { font-size: 11px; overflow-wrap: anywhere; }
    .titulo { margin-top: 2mm; font-size: 11px; letter-spacing: 1px; }
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
    .rodape { margin-top: 1mm; font-size: 11px; overflow-wrap: anywhere; }
</style>
</head>
<body>
<section>${corpo}</section>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.srcdoc = html;

    return new Promise(resolve => {
        iframe.onload = () => {
            const janela = iframe.contentWindow;
            if (!janela) return resolve();
            janela.onafterprint = () => {
                iframe.remove();
                resolve();
            };
            janela.focus();
            janela.print();
        };

        document.body.appendChild(iframe);
    });
}

export async function imprimirComprovante(dados: DadosComprovante, vias: Via[]) {
    const cab = await cabecalho();
    const quitado = quitou(dados);
    const mostraSaldo = dados.saldo !== undefined && !quitado;
    const rotuloSaldo = dados.saldoDeHoje ? 'Saldo em aberto hoje' : 'Saldo em aberto';

    const corpo = (via: Via) => `
    ${dados.reimpressao ? '<p class="centro reimpressao">REIMPRESSÃO</p>' : ''}
    ${htmlCabecalho(cab)}
    <p class="centro titulo">COMPROVANTE DE PAGAMENTO</p>
    <p class="centro via">${NOME_VIA[via]}</p>
    <hr>
    ${dados.numero ? `<p class="linha"><span>Nº</span><span><b>${numeroRecibo(dados.numero)}</b></span></p>` : ''}
    <p class="linha"><span>Cliente</span><span><b>${escapar(dados.cliente)}</b></span></p>
    <p class="linha"><span>${dados.reimpressao ? 'Pago em' : 'Data'}</span><span>${quandoFoiPago(dados)}</span></p>
    ${dados.reimpressao ? `<p class="linha"><span>Reimpresso em</span><span>${dataHoraBR()}</span></p>` : ''}
    <hr>
    <div class="centro">
        <p class="rotulo">VALOR PAGO</p>
        <p class="valor">${FormatarValor(dados.valor)}</p>
        ${dados.forma ? `<p>${escapar(nomeForma(dados.forma))}</p>` : ''}
        ${quitado ? '<p class="quitado">QUITADO</p>' : ''}
    </div>
    <hr>
    ${mostraSaldo ? `<p class="linha"><span>${rotuloSaldo}</span><span><b>${FormatarValor(dados.saldo!)}</b></span></p>` : ''}
    ${dados.atendente ? `<p class="linha"><span>Atendente</span><span>${escapar(dados.atendente)}</span></p>` : ''}
    ${mostraSaldo || dados.atendente ? '<hr>' : ''}
    <p class="centro rodape">${escapar(cab.rodape ?? RODAPE_PADRAO)}</p>`;

    // Uma impressão por via, uma depois da outra: a térmica só corta no fim de cada impressão, então as duas vias
    // na mesma impressão saíam emendadas num cupom só. A pausa dá tempo da primeira ir pra impressora.
    for (const [i, via] of vias.entries()) {
        if (i > 0) await new Promise(r => setTimeout(r, 800));
        await imprimir(`Comprovante de pagamento - ${NOME_VIA[via].toLowerCase()}`, corpo(via));
    }
}

// Mesmo comprovante em texto, pro cliente que pagou sem estar na loja.
async function textoComprovante(dados: DadosComprovante) {
    const cab = await cabecalho();
    const quitado = quitou(dados);

    const linhas = [
        `*${cab.nome}*`,
        `Comprovante de pagamento${dados.numero ? ` nº ${numeroRecibo(dados.numero)}` : ''}`,
        '',
        `Cliente: ${dados.cliente}`,
        `Data: ${quandoFoiPago(dados)}`,
        `Valor pago: *${FormatarValor(dados.valor)}*${dados.forma ? ` (${nomeForma(dados.forma)})` : ''}`,
    ];
    if (quitado) linhas.push('Situação: *quitado* ✅');
    else if (dados.saldo !== undefined) linhas.push(`${dados.saldoDeHoje ? 'Saldo em aberto hoje' : 'Saldo em aberto'}: ${FormatarValor(dados.saldo)}`);
    linhas.push('', cab.rodape ?? RODAPE_PADRAO);

    return linhas.join('\n');
}

// Com WhatsApp cadastrado abre a conversa já com a mensagem; sem, copia a mensagem (igual ao "Cobrar pelo WhatsApp").
export async function enviarComprovanteWhatsApp(dados: DadosComprovante, whatsapp: string | null | undefined) {
    const mensagem = await textoComprovante(dados);
    const digitos = String(whatsapp ?? '').replace(/\D/g, '');

    if (digitos) {
        window.open(linkWhatsApp(digitos, mensagem), '_blank');
        return;
    }

    await navigator.clipboard.writeText(mensagem);
    Swal.showValidationMessage('Cliente sem WhatsApp cadastrado. Comprovante copiado, é só colar na conversa.');
}

// Extrato do que o cliente deve: uma linha por nota em aberto (da mais antiga pra mais nova) e o total.
export async function imprimirExtrato({ cliente, notas }: ExtratoProps) {
    const cab = await cabecalho();

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

    await imprimir('Extrato do cliente', `
    ${htmlCabecalho(cab)}
    <p class="centro titulo">NOTAS EM ABERTO</p>
    <hr>
    <p class="linha"><span>Cliente</span><span><b>${escapar(cliente)}</b></span></p>
    <p class="linha"><span>Emitido em</span><span>${dataHoraBR()}</span></p>
    <hr>
    ${emAberto.length === 0 ? '<p class="centro">Nenhuma nota em aberto.</p>' : linhas}
    <hr>
    <p class="linha"><span>Notas em aberto</span><span>${emAberto.length}</span></p>
    <p class="linha total"><span>TOTAL</span><span>${FormatarValor(total)}</span></p>
    <hr>
    <p class="centro rodape">${escapar(cab.rodape ?? RODAPE_PADRAO)}</p>`);
}

type OferecerProps = {
    titulo: string,
    texto?: string,
    sucesso?: boolean,
    dados: DadosComprovante,
    whatsapp: string | null | undefined
}

// Oferece o comprovante: imprimir (escolhendo as vias) e/ou mandar pelo WhatsApp. O WhatsApp não fecha a janela,
// pra dar pra mandar pro cliente e ainda imprimir a via da loja. A última escolha de vias fica guardada no
// navegador, pra quem sempre imprime só uma não ter que desmarcar toda vez.
export async function oferecerComprovante({ titulo, texto, sucesso = false, dados, whatsapp }: OferecerProps) {
    cabecalho(); // já vai buscando, pra impressão e WhatsApp saírem na hora do clique

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
        titleText: titulo,
        icon: sucesso ? 'success' : undefined,
        html: `
            ${texto ? `<p>${escapar(texto)}</p>` : ''}
            <div style="display:flex;flex-direction:column;gap:8px;width:fit-content;margin:16px auto 0;text-align:left;">
                ${caixa('cliente', 'Via do cliente')}
                ${caixa('loja', 'Via da loja')}
            </div>
            <button type="button" id="copiar-comprovante" style="margin-top:16px;font-size:14px;text-decoration:underline;cursor:pointer;background:none;border:0;color:#475569;">
                Só copiar o texto do comprovante
            </button>`,
        didOpen: () => {
            // pra colar em outro lugar (outro número, e-mail...) sem abrir o WhatsApp
            const botao = document.getElementById('copiar-comprovante');
            botao?.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(await textoComprovante(dados));
                    botao.textContent = 'Copiado!';
                } catch {
                    botao.textContent = 'Não deu pra copiar neste navegador';
                }
            });
        },
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Imprimir',
        confirmButtonColor: '#3C32E6',
        denyButtonText: 'Enviar por WhatsApp',
        denyButtonColor: '#25D366',
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
        },
        preDeny: async () => {
            await enviarComprovanteWhatsApp(dados, whatsapp);
            return false;
        }
    });

    if (!result.isConfirmed || !result.value) return;

    const vias = result.value as Via[];
    try { localStorage.setItem(CHAVE_VIAS, JSON.stringify(vias)); } catch { /* sem storage: só não lembra */ }
    await imprimirComprovante(dados, vias);
}
