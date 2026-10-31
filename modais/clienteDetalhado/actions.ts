'use server'

import prisma from "@/lib/prisma";
import { cookies } from "next/headers"
import { jwtVerify } from 'jose';
import RegistrarAcao from "@/lib/logger";
import { FormatarValor, hojeBR, diasAteVencer, formatarDataBR } from "@/lib/mask";
import autenticar from "@/lib/auth";
import { pode } from "@/lib/permissoesServidor";
import { Prisma } from "@prisma/client";
import { formaValida } from "@/lib/formas";
import { Recibo } from "@/types";
import { SELECT_EXTRAS, extrasParaTela } from "@/lib/cliente";
import { criarTokenExtrato } from "@/lib/linkExtrato";
import { configJurosDe, jurosDaNota, hojeISOBR } from "@/lib/juros";
import { codigoPix, configPixDe } from "@/lib/pix";
import bcrypt from "bcrypt";

type PagAvulsoProps = {
    id: number,
    valor: string | number,
    forma: string
}

type PagEspecificoProps = {
    tipo: 'parcial' | 'total',
    id: Number,
    valor: Number | string,
    forma: string
}

type AbrirReciboProps = {
    empresaId: number,
    clienteId: number,
    usuarioId: number,
    valor: number,
    forma: string
}

// Abre o recibo do pagamento dentro da transação, já com o número dele. A trava na linha da empresa enfileira os
// recibos da mesma empresa, pra dois pagamentos simultâneos não pegarem o mesmo número. NO KEY UPDATE (e não
// UPDATE) porque os inserts de pagamentos/pedidos seguram KEY SHARE na empresa: com FOR UPDATE, dois pagamentos
// ao mesmo tempo se travariam um no outro.
async function abrirRecibo(tx: Prisma.TransactionClient, { empresaId, clienteId, usuarioId, valor, forma }: AbrirReciboProps) {
    await tx.$queryRaw`SELECT id FROM empresa WHERE id = ${empresaId} FOR NO KEY UPDATE`;

    const ultimo = await tx.recibos.aggregate({ where: { empresa_id: empresaId }, _max: { numero: true } });
    const usuario = await tx.usuarios.findUnique({ where: { id: usuarioId }, select: { nome: true } });

    return tx.recibos.create({
        data: {
            empresa_id: empresaId,
            numero: (ultimo._max.numero ?? 0) + 1,
            id_cliente: clienteId,
            usuario_id: usuario ? usuarioId : null,
            atendente: usuario?.nome ?? null,
            valor,
            forma
        }
    });
}

// Fecha o recibo gravando quanto o cliente ficou devendo depois do pagamento (mesma regra do card: só nota com
// saldo > 0). Chamar depois de abater as notas.
async function fecharRecibo(tx: Prisma.TransactionClient, reciboId: number, empresaId: number, clienteId: number): Promise<Recibo> {
    const linhas = await tx.$queryRaw<{ saldo: any }[]>`
        SELECT COALESCE(SUM(valor_inicial - valor_abatido), 0) AS saldo FROM pedidos
        WHERE id_cliente = ${clienteId} AND empresa_id = ${empresaId} AND valor_inicial > valor_abatido
    `;
    const recibo = await tx.recibos.update({
        where: { id: reciboId },
        data: { saldo_apos: Number(Number(linhas[0]?.saldo ?? 0).toFixed(2)) }
    });

    return {
        numero: recibo.numero,
        criadoEm: recibo.criado_em.toISOString(),
        forma: recibo.forma,
        valor: Number(recibo.valor),
        saldoApos: Number(recibo.saldo_apos),
        atendente: recibo.atendente
    };
}

const FORMA_INVALIDA = { success: false as const, error: 'Escolha a forma de pagamento.' }

export async function pagamentoAvulso({ id, valor, forma }: PagAvulsoProps) {
    // autenticar() (fora do try, pra o redirect de sessão inválida funcionar) também barra empresa vencida ou
    // inativa. Antes esta ação lia o JWT direto e continuava aceitando pagamento por até 24h depois do bloqueio.
    const dados = await autenticar()
    if (!dados) return { success: false, error: "Sessão expirada ou inválida" };

    try {
        const empresaId = Number(dados.empresa_id);
        const userId = Number(dados.usuario_id);
        const valorNumerico = Number(valor)

        // valor vazio, zero, negativo ou não numérico "passava" e devolvia "Pagamento processado" sem fazer nada
        if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
            return { success: false, error: 'Informe um valor maior que zero.' }
        }
        if (!formaValida(forma)) return FORMA_INVALIDA

        const resultado = await prisma.$transaction(async (tx) => {
            // Trava as linhas (FOR UPDATE) para impedir que outro pagamento concorrente
            // leia o mesmo saldo "velho" antes deste terminar.
            const notasRowRaw = await tx.$queryRaw<any[]>`
                SELECT * FROM pedidos
                WHERE id_cliente = ${Number(id)}
                  AND empresa_id = ${Number(empresaId)}
                ORDER BY data ASC, id ASC
                FOR UPDATE
            `;
            const notasComSaldo = notasRowRaw
                .map(n => ({
                    ...n,
                    saldoReal: Number((Number(n.valor_inicial) - Number(n.valor_abatido)).toFixed(2))
                }))
                .filter(n => n.saldoReal > 0);

            if (notasComSaldo.length === 0) throw new Error('SEM_SALDO');

            const valorTotalDevedor = Number(notasComSaldo.reduce((acc, n) => acc + n.saldoReal, 0).toFixed(2));

            if (valorNumerico > valorTotalDevedor) {
                throw new Error('VALOR_EXCESSIVO|' + valorTotalDevedor);
            }

            const recibo = await abrirRecibo(tx, { empresaId, clienteId: Number(id), usuarioId: userId, valor: valorNumerico, forma });

            let valorPagamentoRestante = valorNumerico;
            const notasAtualizadasFull = [];

            for (const nota of notasComSaldo) {
                if (valorPagamentoRestante <= 0) break;
                let valorAbatidoAgora = Math.min(valorPagamentoRestante, nota.saldoReal);
                valorAbatidoAgora = Number(valorAbatidoAgora.toFixed(2));

                if (valorAbatidoAgora > 0) {
                    // 1. CAPTURAR A NOTA ATUALIZADA
                    const notaDepoisDoUpdate = await tx.pedidos.update({
                        where: { id: nota.id },
                        data: {
                            valor_abatido: { increment: valorAbatidoAgora },
                            valor_restante: Number((nota.saldoReal - valorAbatidoAgora).toFixed(2))
                        }
                    });

                    await tx.pagamentos.create({
                        data: {
                            id_cliente: Number(id),
                            valor: valorAbatidoAgora,
                            nota_abatida: nota.id,
                            empresa_id: Number(empresaId),
                            recibo_id: recibo.id,
                            data: hojeBR()
                        }
                    });

                    notasAtualizadasFull.push({
                        ...notaDepoisDoUpdate,
                        valor_abatido: Number(notaDepoisDoUpdate.valor_abatido),
                        valor_inicial: Number(notaDepoisDoUpdate.valor_inicial),
                        valor_restante: Number(notaDepoisDoUpdate.valor_restante),
                        valor_unitario: Number(notaDepoisDoUpdate.valor_unitario),
                        valor_extra: Number(notaDepoisDoUpdate.valor_extra),
                    });

                    valorPagamentoRestante = Number((valorPagamentoRestante - valorAbatidoAgora).toFixed(2));
                }
            }

            return { notasAtualizadasFull, recibo: await fecharRecibo(tx, recibo.id, empresaId, Number(id)) };
        }, { timeout: 10000 });

        const cliente = await prisma.clientes.findUnique({ where: { id: Number(id) }, select: { nome: true, whatsapp: true } });
        const txt = `Registrado pagamento de ${FormatarValor(valorNumerico)} para o cliente ${cliente?.nome || 'Desconhecido'}`;

        await RegistrarAcao({
            tabela: 'Pagamentos',
            operacao: txt,
            empresa_id: empresaId,
            usuario_id: userId
        });

        return {
            success: true,
            mensagem: 'Pagamento processado com sucesso!',
            notaAtualizada: resultado.notasAtualizadasFull,
            recibo: resultado.recibo,
            whatsapp: cliente?.whatsapp ? String(cliente.whatsapp) : null
        };

    } catch (error: any) {
        if (error.message === 'SEM_SALDO') {
            return { success: false, error: 'Este cliente não possui saldo devedor.' };
        }
        if (error.message.startsWith('VALOR_EXCESSIVO')) {
            const saldo = error.message.split('|')[1];
            return { success: false, error: `Valor excessivo. O saldo total é ${FormatarValor(Number(saldo))}` };
        }

        console.error('[pagamentoAvulso]', error);
        return { success: false, error: 'Falha crítica ao processar o pagamento.' };
    }
}

export async function pagamentoEspecifico({ tipo, id, valor, forma }: PagEspecificoProps) {

    const dados = await autenticar()

    if (!dados) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    const empresaId = Number(dados.empresa_id)
    const userId = Number(dados.usuario_id)

    if (!formaValida(forma)) return FORMA_INVALIDA

    if (tipo === 'parcial') {

        try {
            const valorNumerico = Number(valor)
            if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
                return { success: false, error: 'Informe um valor maior que zero.' }
            }

            // Tudo numa transação: o abatimento da nota e a linha em `pagamentos` (que alimenta a aba
            // Pagamentos) entram juntos ou nenhum entra. Antes só a nota era abatida e o pagamento
            // "sumia" do histórico (pagamentoAvulso, o botão de cima, sempre gravou a linha).
            const { nota: notaAlterada, recibo } = await prisma.$transaction(async (tx) => {
                // Update atomico e guardado: so aplica se a nota for dessa empresa
                // e ainda tiver saldo suficiente no momento exato da escrita —
                // evita corrida entre dois pagamentos simultaneos na mesma nota.
                const resultado = await tx.pedidos.updateMany({
                    where: {
                        id: Number(id),
                        empresa_id: empresaId,
                        valor_restante: { gte: valorNumerico }
                    },
                    data: {
                        valor_abatido: { increment: valorNumerico },
                        valor_restante: { decrement: valorNumerico }
                    }
                })

                if (resultado.count === 0) throw new Error('SEM_SALDO_NOTA')

                const nota = await tx.pedidos.findUnique({ where: { id: Number(id) } })
                if (!nota) throw new Error('NOTA_NAO_ENCONTRADA')

                if (!nota.id_cliente) return { nota, recibo: null }

                const recibo = await abrirRecibo(tx, { empresaId, clienteId: nota.id_cliente, usuarioId: userId, valor: valorNumerico, forma })
                await tx.pagamentos.create({
                    data: {
                        id_cliente: nota.id_cliente,
                        valor: valorNumerico,
                        nota_abatida: nota.id,
                        empresa_id: empresaId,
                        recibo_id: recibo.id,
                        data: hojeBR()
                    }
                })
                return { nota, recibo: await fecharRecibo(tx, recibo.id, empresaId, nota.id_cliente) }
            }, { timeout: 10000 })

            const cliente = notaAlterada.id_cliente
                ? await prisma.clientes.findUnique({ where: { id: notaAlterada.id_cliente }, select: { nome: true, whatsapp: true } })
                : null;

            await RegistrarAcao({
                tabela: 'Pagamentos',
                operacao: `Registrou pagamento parcial de ${FormatarValor(valorNumerico)}${cliente?.nome ? ` para o cliente ${cliente.nome}` : ''}`,
                empresa_id: empresaId,
                usuario_id: Number(dados.usuario_id)
            });

            return {
                success: true,
                recibo,
                whatsapp: cliente?.whatsapp ? String(cliente.whatsapp) : null,
                notaAtualizada: {
                    ...notaAlterada,
                    valor_abatido: Number(notaAlterada.valor_abatido),
                    valor_inicial: Number(notaAlterada.valor_inicial),
                    valor_restante: Number(notaAlterada.valor_restante),
                    valor_extra: Number(notaAlterada.valor_extra),
                    valor_unitario: Number(notaAlterada.valor_unitario)
                }
            };


        } catch (error: any) {
            if (error?.message === 'SEM_SALDO_NOTA') {
                return {
                    success: false,
                    error: 'Não foi possível registrar o pagamento — valor maior que o saldo da nota, ou nota inválida.'
                }
            }
            if (error?.message === 'NOTA_NAO_ENCONTRADA') return { success: false, error: 'Nota não encontrada.' }
            console.error("Erro no pagamento parcial:", error)
            return {
                success: false,
                error: "Erro ao registrar o pagamento parcial."
            }

        }
    } else
        if (tipo === 'total') {

            try {
                // Lê o saldo da nota com trava (FOR UPDATE), quita com SET direto contra valor_inicial (imutavel,
                // idempotente) e grava em `pagamentos` o valor que faltava — tudo na mesma transação, pra o
                // pagamento aparecer na aba Pagamentos (antes só a nota era quitada).
                const resultado = await prisma.$transaction(async (tx) => {
                    const linhas = await tx.$queryRaw<{ id_cliente: number | null, valor_inicial: any, valor_abatido: any }[]>`
                        SELECT id_cliente, valor_inicial, valor_abatido FROM pedidos
                        WHERE id = ${Number(id)} AND empresa_id = ${empresaId}
                        FOR UPDATE
                    `
                    if (linhas.length === 0) return null

                    const nota = linhas[0]
                    const saldo = Number((Number(nota.valor_inicial) - Number(nota.valor_abatido)).toFixed(2))

                    await tx.$executeRaw`
                        UPDATE pedidos
                        SET valor_abatido = valor_inicial, valor_restante = 0
                        WHERE id = ${Number(id)} AND empresa_id = ${empresaId}
                    `

                    // nota que já estava quitada não gera pagamento novo
                    if (saldo > 0 && nota.id_cliente) {
                        const recibo = await abrirRecibo(tx, { empresaId, clienteId: nota.id_cliente, usuarioId: userId, valor: saldo, forma })
                        await tx.pagamentos.create({
                            data: {
                                id_cliente: nota.id_cliente,
                                valor: saldo,
                                nota_abatida: Number(id),
                                empresa_id: empresaId,
                                recibo_id: recibo.id,
                                data: hojeBR()
                            }
                        })
                        return { recibo: await fecharRecibo(tx, recibo.id, empresaId, nota.id_cliente) }
                    }
                    return { recibo: null }
                }, { timeout: 10000 })

                if (!resultado) {
                    return {
                        success: false,
                        error: 'Nota não encontrada.'
                    }
                }

                const updateNota = await prisma.pedidos.findUnique({ where: { id: Number(id) } })

                const cliente = updateNota?.id_cliente
                    ? await prisma.clientes.findUnique({ where: { id: updateNota.id_cliente }, select: { nome: true, whatsapp: true } })
                    : null;

                await RegistrarAcao({
                    tabela: 'Pagamentos',
                    operacao: `Registrou pagamento total${cliente?.nome ? ` para o cliente ${cliente.nome}` : ''}`,
                    empresa_id: empresaId,
                    usuario_id: Number(dados.usuario_id)
                });

                return {
                    success: true,
                    recibo: resultado.recibo,
                    whatsapp: cliente?.whatsapp ? String(cliente.whatsapp) : null,
                    notaAtualizada: {
                        ...updateNota,
                        valor_abatido: Number(updateNota?.valor_abatido),
                        valor_inicial: Number(updateNota?.valor_inicial),
                        valor_restante: Number(updateNota?.valor_restante),
                        valor_extra: Number(updateNota?.valor_extra),
                        valor_unitario: Number(updateNota?.valor_unitario)
                    }
                };
            } catch (error: any) {
                console.error("Erro no pagamento total:", error)

                return {
                    success: false,
                    error: "Erro ao registrar o pagamento total."
                };
            }
        }

}

export async function CobrarBack(id: number) {

    const Auth = await autenticar()

    if (!Auth) {
        return null
    }

    const clienteComNotas = await prisma.clientes.findFirst({
        where: { id: Number(id), empresa_id: Number(Auth.empresa_id) },
        include: { pedidos: true }
    });

    if (!clienteComNotas) return null;

    const notasDevedoras = clienteComNotas.pedidos.filter(nota => {
        return Number(nota.valor_inicial) - Number(nota.valor_abatido) > 0;
    });

    const quantidadeNotas = notasDevedoras.length;
    const totalDevedor = notasDevedoras.reduce((acc, nota) => {
        const saldo = Number(nota.valor_inicial) - Number(nota.valor_abatido);
        return acc + saldo;
    }, 0);

    const dadosDoCliente = {
        ...clienteComNotas,
        quantidadeNotas,
        totalDevedor: Number(totalDevedor.toFixed(2))
    };

    const modalDaMensagem = await prisma.empresa_settings.findFirst({
        where: { empresa_id: Number(clienteComNotas.empresa_id) }
    });

    let mensagem = "";

    // Data combinada pra pagar: a mais próxima entre as notas em aberto (se já passou, é a que está atrasada há
    // mais tempo). Vira uma frase dentro da mensagem; sem data combinada a frase some e o texto fica como era.
    const vencimentos = notasDevedoras.map(n => n.vencimento).filter((v): v is Date => !!v)
    const vencimento = vencimentos.length ? new Date(Math.min(...vencimentos.map(v => v.getTime()))) : null
    const combinado = vencimento
        ? (diasAteVencer(vencimento) === 0 ? 'O pagamento ficou combinado para hoje. ' : `O pagamento ficou combinado para o dia ${formatarDataBR(vencimento).slice(0, 5)}. `)
        : ''

    // juros por atraso (se a loja ligou): entra como uma frase a mais no fim da mensagem, em qualquer modelo
    const configJuros = configJurosDe(modalDaMensagem)
    const hoje = hojeISOBR()
    const totalJuros = notasDevedoras.reduce((acc, n) =>
        acc + jurosDaNota(Number(n.valor_inicial) - Number(n.valor_abatido), n, configJuros, hoje).valor, 0)
    const fraseJuros = totalJuros > 0
        ? `Com juros e multa por atraso, o total fica ${FormatarValor(dadosDoCliente.totalDevedor + totalJuros)}.`
        : ''


    switch (modalDaMensagem?.cobranca_text) {
 
        case 1:
            mensagem = `Olá, ${dadosDoCliente.nome}! Tudo bem? Passando apenas para te lembrar da(s) nota(s) em aberto no valor de ${FormatarValor(dadosDoCliente.totalDevedor)}. ${combinado}Consegue nos enviar o comprovante?`;
            break;
        case 2:
            mensagem = `Olá, ${dadosDoCliente.nome}. Consta em nosso sistema um em aberto de ${FormatarValor(dadosDoCliente.totalDevedor)} referente a ${dadosDoCliente.quantidadeNotas} nota(s). ${combinado}Poderia nos encaminhar o comprovante?`;
            break;
        case 3:
            mensagem = `Olá, ${dadosDoCliente.nome}! Estamos organizando o fechamento financeiro e notamos ${dadosDoCliente.quantidadeNotas} nota(s) pendente(s) totalizando ${FormatarValor(dadosDoCliente.totalDevedor)}. ${combinado}`.trim();
            break;
        case 4:
            mensagem = `Olá, ${dadosDoCliente.nome}. O débito de ${FormatarValor(dadosDoCliente.totalDevedor)} ainda não foi regularizado. ${combinado}Precisamos do comprovante hoje para evitar bloqueios.`;
            break;
        case 5:
            mensagem = `Olá, ${dadosDoCliente.nome}! 🐾 O fechamento da estadia do seu pet está pronto. O total de diárias e extras ficou em ${FormatarValor(dadosDoCliente.totalDevedor)}. ${combinado}Consegue nos enviar o comprovante? Lambeijos! 🐶`;
            break;
        case 6:
            mensagem = `Oi, ${dadosDoCliente.nome}! Tudo bem? O relatório de diárias e extras do seu pet está pronto. Valor total: ${FormatarValor(dadosDoCliente.totalDevedor)}. ${combinado}Qualquer dúvida sobre os itens, é só avisar! 🐾`;
            break;
        case 7:
            const corpo7 = notasDevedoras.map(n =>
                `*-Dog-*: *${n.descricao || "Pet"}*\n💰 *Subtotal: ${FormatarValor(Number(n.valor_inicial) - Number(n.valor_abatido))}*`
            ).join("\n\n");

            mensagem = `Olá, ${dadosDoCliente.nome}! 🐾 Segue o fechamento:\n\n${corpo7}\n\n✅ *TOTAL GERAL: ${FormatarValor(dadosDoCliente.totalDevedor)}*\n\n${combinado}Consegue nos enviar o comprovante? 🐶`;
            break;
        case 8:
            const corpo8 = notasDevedoras.map(n =>
                `- *${n.descricao || "Pet"}*: ${FormatarValor(Number(n.valor_inicial) - Number(n.valor_abatido))}`
            ).join("\n");

            mensagem = `Oi, ${dadosDoCliente.nome}! Tudo certo? Resumo:\n\n${corpo8}\n\nTotal: *${FormatarValor(dadosDoCliente.totalDevedor)}*. 🐾${combinado ? `\n\n${combinado.trim()}` : ''}`;
            break;

        default:
            mensagem = `Olá ${dadosDoCliente.nome}! O total em aberto é ${FormatarValor(dadosDoCliente.totalDevedor)}. ${combinado}`.trim();
    }

    if (fraseJuros) mensagem = `${mensagem.trim()}\n\n${fraseJuros}`
    const pix = configPixDe(modalDaMensagem)
    if (pix && dadosDoCliente.totalDevedor > 0) mensagem = `${mensagem.trim()}\n\n${textoPix(pix, dadosDoCliente.totalDevedor)}`

    return {
        mensagem,
        whatsapp: dadosDoCliente.whatsapp ? String(dadosDoCliente.whatsapp) : null
    }
}



// Combinar ou remarcar o dia de pagar de uma nota já lançada ("pago semana que vem"). null tira a data combinada
// (a nota volta pra regra antiga dos 30 dias).
export async function combinarVencimento(notaId: number, vencimento: string | null) {
    const Auth = await autenticar()
    if (!Auth) return { success: false, error: "Sessão expirada ou inválida" }

    const nota = await prisma.pedidos.findFirst({
        where: { id: Number(notaId), empresa_id: Number(Auth.empresa_id) },
        include: { clientes: { select: { nome: true } } }
    })
    if (!nota) return { success: false, error: "Nota não encontrada." }

    const data = vencimento ? new Date(`${vencimento}T00:00:00.000Z`) : null
    if (data && isNaN(data.getTime())) return { success: false, error: "Data inválida." }
    if (data && data < nota.data) return { success: false, error: "A data combinada não pode ser antes da data da venda." }

    await prisma.pedidos.update({ where: { id: nota.id }, data: { vencimento: data } })

    await RegistrarAcao({
        tabela: 'Notas',
        operacao: data
            ? `Combinou pagamento da nota de ${nota.clientes?.nome} para ${formatarDataBR(data)}`
            : `Tirou a data combinada da nota de ${nota.clientes?.nome}`,
        empresa_id: Number(Auth.empresa_id),
        usuario_id: Number(Auth.usuario_id)
    })

    return { success: true }
}


// Aba "Resumo" da ficha: os números do cliente e o cadastro completo. Tudo leitura, numa consulta só.
// Regras: nota de 0001-01-01 (lixo de importação antiga) fica fora de tudo; "dias pra quitar" só conta nota quitada
// que tem o pagamento registrado (as de antes do histórico de pagamentos não têm data de quando foram pagas);
// "total já pago" soma o abatido das notas, que inclui esses pagamentos antigos.
export async function resumoDoClienteBack(clienteId: number) {
    const Auth = await autenticar()
    if (!Auth) return { success: false as const, error: "Sessão expirada ou inválida" }

    const empresaId = Number(Auth.empresa_id)
    const id = Number(clienteId)

    const cliente = await prisma.clientes.findFirst({
        where: { id, empresa_id: empresaId },
        select: { id: true, nome: true, whatsapp: true, documento: true, ...SELECT_EXTRAS }
    })
    if (!cliente) return { success: false as const, error: "Cliente não encontrado." }

    try {
        const [linha] = await prisma.$queryRaw<any[]>`
            WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS dia),
            n AS (
                SELECT * FROM pedidos
                WHERE empresa_id = ${empresaId} AND id_cliente = ${id} AND data > DATE '1900-01-01'
            ),
            ult5 AS (SELECT valor_inicial FROM n ORDER BY data DESC, id DESC LIMIT 5),
            quitadas AS (
                SELECT GREATEST(MAX(g.data) - n.data, 0) AS dias
                FROM n JOIN pagamentos g ON g.nota_abatida = n.id
                WHERE n.valor_restante <= 0
                GROUP BY n.id, n.data
            ),
            -- frequência: intervalo médio entre os últimos 10 dias em que ele comprou
            datas AS (SELECT DISTINCT data FROM n ORDER BY data DESC LIMIT 10)
            SELECT
                (SELECT AVG(valor_inicial) FROM ult5) AS media_ultimas,
                (SELECT COUNT(*) FROM ult5) AS qtd_ultimas,
                (SELECT AVG(dias) FROM quitadas) AS media_dias_quitar,
                (SELECT MAX(dias) FROM quitadas) AS maior_demora,
                (SELECT COUNT(*) FROM quitadas) AS notas_quitadas,
                (SELECT MIN(data) FROM n WHERE valor_restante > 0) AS aberta_mais_antiga,
                (SELECT COALESCE(SUM(valor_restante), 0) FROM n WHERE valor_restante > 0) AS deve,
                (SELECT COUNT(*) FROM n, hoje WHERE date_trunc('month', data) = date_trunc('month', hoje.dia)) AS notas_mes,
                (SELECT COALESCE(SUM(valor_inicial), 0) FROM n, hoje WHERE date_trunc('month', data) = date_trunc('month', hoje.dia)) AS valor_mes,
                (SELECT COUNT(*) FROM n, hoje WHERE date_trunc('year', data) = date_trunc('year', hoje.dia)) AS notas_ano,
                (SELECT COALESCE(SUM(valor_inicial), 0) FROM n, hoje WHERE date_trunc('year', data) = date_trunc('year', hoje.dia)) AS valor_ano,
                (SELECT COUNT(*) FROM n) AS notas_total,
                (SELECT COALESCE(SUM(valor_inicial), 0) FROM n) AS total_comprado,
                (SELECT COALESCE(SUM(valor_abatido), 0) FROM n) AS total_pago,
                (SELECT MIN(data) FROM n) AS cliente_desde,
                (SELECT MAX(data) FROM n) AS ultima_compra,
                (SELECT hoje.dia - MAX(n.data) FROM n, hoje GROUP BY hoje.dia) AS dias_sem_comprar,
                (SELECT (MAX(data) - MIN(data))::float / NULLIF(COUNT(*) - 1, 0) FROM datas) AS intervalo_medio,
                (SELECT COUNT(*) FROM datas) AS dias_com_compra
        `

        // últimos 12 meses (incluindo o atual): comprado pela data da nota, pago pela data do pagamento
        const meses = await prisma.$queryRaw<{ mes: string, comprado: any, pago: any }[]>`
            WITH hoje AS (SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date AS mes),
            serie AS (SELECT generate_series(hoje.mes - INTERVAL '11 months', hoje.mes, INTERVAL '1 month')::date AS mes FROM hoje)
            SELECT to_char(s.mes, 'YYYY-MM') AS mes,
                (SELECT COALESCE(SUM(valor_inicial), 0) FROM pedidos
                    WHERE empresa_id = ${empresaId} AND id_cliente = ${id} AND date_trunc('month', data) = s.mes) AS comprado,
                (SELECT COALESCE(SUM(valor), 0) FROM pagamentos
                    WHERE empresa_id = ${empresaId} AND id_cliente = ${id} AND date_trunc('month', data) = s.mes) AS pago
            FROM serie s ORDER BY s.mes
        `

        const num = (v: any) => (v == null ? null : Number(v))
        const data = (v: any) => (v ? new Date(v).toISOString() : null)
        const frequenciaConfiavel = Number(linha.dias_com_compra) >= 3

        return {
            success: true as const,
            cadastro: {
                ...cliente,
                ...extrasParaTela(cliente),
                whatsapp: cliente.whatsapp ? String(cliente.whatsapp) : null
            },
            resumo: {
                mediaUltimas: num(linha.media_ultimas),
                qtdUltimas: Number(linha.qtd_ultimas),
                mediaDiasQuitar: num(linha.media_dias_quitar),
                maiorDemora: num(linha.maior_demora),
                notasQuitadas: Number(linha.notas_quitadas),
                abertaMaisAntiga: data(linha.aberta_mais_antiga),
                deve: Number(linha.deve),
                notasMes: Number(linha.notas_mes),
                valorMes: Number(linha.valor_mes),
                notasAno: Number(linha.notas_ano),
                valorAno: Number(linha.valor_ano),
                notasTotal: Number(linha.notas_total),
                totalComprado: Number(linha.total_comprado),
                totalPago: Number(linha.total_pago),
                clienteDesde: data(linha.cliente_desde),
                ultimaCompra: data(linha.ultima_compra),
                diasSemComprar: num(linha.dias_sem_comprar),
                intervaloMedio: frequenciaConfiavel ? num(linha.intervalo_medio) : null
            },
            meses: meses.map(m => ({ mes: m.mes, comprado: Number(m.comprado), pago: Number(m.pago) }))
        }
    } catch (error) {
        console.error("[resumoDoClienteBack]", error)
        return { success: false as const, error: "Erro ao montar o resumo do cliente." }
    }
}

// Link do extrato pro cliente abrir no celular (página pública /extrato/<token>, ver lib/linkExtrato.ts)
export async function linkDoExtratoBack(clienteId: number) {
    const Auth = await autenticar()
    if (!Auth) return { success: false as const, error: "Sessão expirada ou inválida" }

    const cliente = await prisma.clientes.findFirst({
        where: { id: Number(clienteId), empresa_id: Number(Auth.empresa_id) },
        select: { id: true, nome: true, whatsapp: true, empresa: { select: { nome: true } } }
    })
    if (!cliente) return { success: false as const, error: "Cliente não encontrado." }

    return {
        success: true as const,
        url: urlDoExtrato(cliente.id),
        nome: cliente.nome,
        whatsapp: cliente.whatsapp ? String(cliente.whatsapp) : null,
        loja: cliente.empresa?.nome ?? '',
    }
}

// Config de juros da loja pra ficha calcular nota a nota (desligado = nada aparece)
export async function configJurosBack() {
    const Auth = await autenticar()
    if (!Auth) return configJurosDe(null)
    const s = await prisma.empresa_settings.findFirst({
        where: { empresa_id: Number(Auth.empresa_id) },
        select: { juros_ativo: true, juros_mes: true, multa_atraso: true, juros_carencia: true }
    })
    return configJurosDe(s)
}

function urlDoExtrato(clienteId: number, dias?: number) {
    const base = (process.env.APP_URL ?? 'https://app.zentrax.dvls.com.br').replace(/\/$/, '')
    return `${base}/extrato/${criarTokenExtrato(clienteId, dias)}`
}

// O que o comprovante precisa além do recibo: quais notas esse pagamento abateu (e quanto ficou em cada uma logo
// depois dele) e o link do extrato pro QR code. Serve pra pagamento de agora e pra reimpressão.
export async function detalhesDoReciboBack(numero: number) {
    const Auth = await autenticar()
    if (!Auth) return null
    const empresaId = Number(Auth.empresa_id)

    const recibo = await prisma.recibos.findFirst({
        where: { empresa_id: empresaId, numero: Number(numero) },
        select: { id: true, id_cliente: true, saldo_apos: true, estornado_em: true }
    })
    if (!recibo) return null
    const settings = await prisma.empresa_settings.findFirst({
        where: { empresa_id: empresaId },
        select: { pix_chave: true, pix_nome: true, pix_cidade: true, qr_extrato: true }
    })
    const pix = configPixDe(settings)
    const saldo = Number(recibo.saldo_apos)

    // "ficou" = saldo de hoje + o que foi pago nessa nota DEPOIS desse recibo: assim a reimpressão de um recibo
    // antigo mostra o saldo daquele dia, não o de hoje
    const notas = await prisma.$queryRaw<{ data: Date, descricao: string | null, valor_inicial: string, pago: string, ficou: string }[]>`
        SELECT p.data, p.descricao, p.valor_inicial, g.valor AS pago,
               (p.valor_inicial - p.valor_abatido) + COALESCE((
                   SELECT SUM(g2.valor) FROM pagamentos g2 WHERE g2.nota_abatida = p.id AND g2.id > g.id
               ), 0) AS ficou
        FROM pagamentos g JOIN pedidos p ON p.id = g.nota_abatida
        WHERE g.recibo_id = ${recibo.id} AND g.empresa_id = ${empresaId}
        ORDER BY p.data, p.id
    `

    return {
        notas: notas.map(n => ({
            data: new Date(n.data).toISOString(),
            descricao: n.descricao,
            valorNota: Number(n.valor_inicial),
            pago: Number(n.pago),
            ficou: Math.max(0, Number(n.ficou)),
        })),
        linkExtrato: urlDoExtrato(recibo.id_cliente, 90),
        // Pix do que ficou devendo (com o valor já preenchido); sem Pix configurado ou sem saldo, não vai
        pix: pix && saldo > 0.009 ? { codigo: codigoPix(pix, saldo), valor: saldo } : null,
        estornado: !!recibo.estornado_em,
        // a loja pode desligar o QR das notas no papel (Preferências > Comprovante); o link no WhatsApp continua
        qrExtrato: settings?.qr_extrato !== false,
    }
}

// Bloco do Pix nas mensagens de WhatsApp: a chave pra quem prefere digitar e o copia e cola com o valor
function textoPix(pix: NonNullable<ReturnType<typeof configPixDe>>, valor: number) {
    return `Pra pagar no Pix, a chave é ${pix.chave}. Ou copie o código abaixo, que já vem com o valor:\n${codigoPix(pix, valor)}`
}

// Desfazer um pagamento lançado errado (gestor, ou atendente liberado; sempre com a senha). Devolve o valor pras notas que ele abateu, apaga
// as linhas de pagamento e marca o recibo como estornado: o número não some (a sequência não fica com buraco) e o
// Histórico registra quem desfez. Pagamento antigo, de antes do recibo numerado, não dá pra desfazer por aqui.
export async function desfazerPagamentoBack(numero: number, senha: string) {
    const Auth = await autenticar()
    if (!Auth) return { success: false as const, error: "Sessão expirada ou inválida" }
    if (!(await pode(Auth, 'desfazer'))) return { success: false as const, error: "Você não tem permissão pra desfazer pagamento." }

    const empresaId = Number(Auth.empresa_id)
    const usuario = await prisma.usuarios.findUnique({ where: { id: Number(Auth.usuario_id) }, select: { nome: true, senha: true } })
    const senhaOk = usuario?.senha ? await bcrypt.compare(String(senha ?? ''), usuario.senha).catch(() => false) : false
    if (!senhaOk) return { success: false as const, error: "Senha incorreta." }

    try {
        const resultado = await prisma.$transaction(async (tx) => {
            // trava o recibo: dois cliques em "desfazer" ao mesmo tempo não devolvem o valor duas vezes
            const [recibo] = await tx.$queryRaw<{ id: number, id_cliente: number, valor: string, estornado_em: Date | null }[]>`
                SELECT id, id_cliente, valor, estornado_em FROM recibos
                WHERE empresa_id = ${empresaId} AND numero = ${Number(numero)}
                FOR UPDATE
            `
            if (!recibo) throw new Error('NAO_ACHOU')
            if (recibo.estornado_em) throw new Error('JA_ESTORNADO')

            const linhas = await tx.pagamentos.findMany({ where: { recibo_id: recibo.id, empresa_id: empresaId } })
            for (const l of linhas) {
                await tx.$executeRaw`
                    UPDATE pedidos
                    SET valor_abatido = GREATEST(valor_abatido - ${l.valor}, 0),
                        valor_restante = LEAST(valor_restante + ${l.valor}, valor_inicial)
                    WHERE id = ${l.nota_abatida} AND empresa_id = ${empresaId}
                `
            }
            await tx.pagamentos.deleteMany({ where: { recibo_id: recibo.id, empresa_id: empresaId } })
            await tx.recibos.update({
                where: { id: recibo.id },
                data: { estornado_em: new Date(), estornado_por: usuario?.nome ?? null }
            })
            return { valor: Number(recibo.valor), notas: linhas.length }
        })

        await RegistrarAcao({
            tabela: 'Pagamentos',
            operacao: `Desfez o pagamento nº ${String(numero).padStart(6, '0')} de ${FormatarValor(resultado.valor)}`,
            empresa_id: empresaId,
            usuario_id: Number(Auth.usuario_id)
        })
        return { success: true as const, ...resultado }
    } catch (error: any) {
        if (error?.message === 'JA_ESTORNADO') return { success: false as const, error: "Esse pagamento já foi desfeito." }
        if (error?.message === 'NAO_ACHOU') return { success: false as const, error: "Pagamento não encontrado." }
        console.error("[desfazerPagamentoBack]", error)
        return { success: false as const, error: "Não deu pra desfazer o pagamento." }
    }
}

// Lembrete antes de atrasar: "combinamos pra hoje/amanhã". Soma só as notas com dia combinado hoje ou amanhã
// (o resto da conta não entra, pra não parecer cobrança). Vai com o Pix se a loja configurou.
export async function mensagemLembreteBack(clienteId: number) {
    const Auth = await autenticar()
    if (!Auth) return null
    const empresaId = Number(Auth.empresa_id)

    const [cliente, notas, settings] = await Promise.all([
        prisma.clientes.findFirst({ where: { id: Number(clienteId), empresa_id: empresaId }, select: { nome: true, whatsapp: true } }),
        prisma.$queryRaw<{ vencimento: Date, valor: string, hoje: boolean }[]>`
            SELECT vencimento, SUM(valor_inicial - valor_abatido) AS valor,
                   vencimento = (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje
            FROM pedidos
            WHERE id_cliente = ${Number(clienteId)} AND empresa_id = ${empresaId}
              AND valor_inicial - valor_abatido > 0
              AND vencimento BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date AND (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1
            GROUP BY vencimento ORDER BY vencimento
        `,
        prisma.empresa_settings.findFirst({ where: { empresa_id: empresaId }, select: { pix_chave: true, pix_nome: true, pix_cidade: true } }),
    ])
    if (!cliente || notas.length === 0) return null

    const primeiro = notas[0]
    const valor = notas.reduce((acc, n) => acc + Number(n.valor), 0)
    const quando = primeiro.hoje ? 'pra hoje' : `pra amanhã (${formatarDataBR(primeiro.vencimento).slice(0, 5)})`
    const nome = cliente.nome.trim().split(/\s+/)[0]

    let mensagem = `Oi, ${nome}! Tudo bem? Passando só pra lembrar que o pagamento de ${FormatarValor(valor)} ficou combinado ${quando}.`
    const pix = configPixDe(settings)
    if (pix) mensagem += `\n\n${textoPix(pix, valor)}`

    return { mensagem, whatsapp: cliente.whatsapp ? String(cliente.whatsapp) : null }
}
