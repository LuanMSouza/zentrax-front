'use server'

import prisma from "@/lib/prisma";
import { cookies } from "next/headers"
import { jwtVerify } from 'jose';
import RegistrarAcao from "@/lib/logger";
import { FormatarValor, hojeBR } from "@/lib/mask";
import autenticar from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { formaValida } from "@/lib/formas";
import { Recibo } from "@/types";

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


    switch (modalDaMensagem?.cobranca_text) {
 
        case 1:
            mensagem = `Olá, ${dadosDoCliente.nome}! Tudo bem? Passando apenas para te lembrar da(s) nota(s) em aberto no valor de ${FormatarValor(dadosDoCliente.totalDevedor)}. Consegue nos enviar o comprovante?`;
            break;
        case 2:
            mensagem = `Olá, ${dadosDoCliente.nome}. Consta em nosso sistema um em aberto de ${FormatarValor(dadosDoCliente.totalDevedor)} referente a ${dadosDoCliente.quantidadeNotas} nota(s). Poderia nos encaminhar o comprovante?`;
            break;
        case 3:
            mensagem = `Olá, ${dadosDoCliente.nome}! Estamos organizando o fechamento financeiro e notamos ${dadosDoCliente.quantidadeNotas} nota(s) pendente(s) totalizando ${FormatarValor(dadosDoCliente.totalDevedor)}.`;
            break;
        case 4:
            mensagem = `Olá, ${dadosDoCliente.nome}. O débito de ${FormatarValor(dadosDoCliente.totalDevedor)} ainda não foi regularizado. Precisamos do comprovante hoje para evitar bloqueios.`;
            break;
        case 5:
            mensagem = `Olá, ${dadosDoCliente.nome}! 🐾 O fechamento da estadia do seu pet está pronto. O total de diárias e extras ficou em ${FormatarValor(dadosDoCliente.totalDevedor)}. Consegue nos enviar o comprovante? Lambeijos! 🐶`;
            break;
        case 6:
            mensagem = `Oi, ${dadosDoCliente.nome}! Tudo bem? O relatório de diárias e extras do seu pet está pronto. Valor total: ${FormatarValor(dadosDoCliente.totalDevedor)}. Qualquer dúvida sobre os itens, é só avisar! 🐾`;
            break;
        case 7:
            const corpo7 = notasDevedoras.map(n =>
                `*-Dog-*: *${n.descricao || "Pet"}*\n💰 *Subtotal: ${FormatarValor(Number(n.valor_inicial) - Number(n.valor_abatido))}*`
            ).join("\n\n");

            mensagem = `Olá, ${dadosDoCliente.nome}! 🐾 Segue o fechamento:\n\n${corpo7}\n\n✅ *TOTAL GERAL: ${FormatarValor(dadosDoCliente.totalDevedor)}*\n\nConsegue nos enviar o comprovante? 🐶`;
            break;
        case 8:
            const corpo8 = notasDevedoras.map(n =>
                `- *${n.descricao || "Pet"}*: ${FormatarValor(Number(n.valor_inicial) - Number(n.valor_abatido))}`
            ).join("\n");

            mensagem = `Oi, ${dadosDoCliente.nome}! Tudo certo? Resumo:\n\n${corpo8}\n\nTotal: *${FormatarValor(dadosDoCliente.totalDevedor)}*. 🐾`;
            break;

        default:
            mensagem = `Olá ${dadosDoCliente.nome}! O total em aberto é ${FormatarValor(dadosDoCliente.totalDevedor)}.`;
    }

    return {
        mensagem,
        whatsapp: dadosDoCliente.whatsapp ? String(dadosDoCliente.whatsapp) : null
    }
}


