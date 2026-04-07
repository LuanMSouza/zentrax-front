'use server'

import prisma from "@/lib/prisma";
import { cookies } from "next/headers"
import { jwtVerify } from 'jose';
import RegistrarAcao from "@/lib/logger";
import { FormatarValor } from "@/lib/mask";
import autenticar from "@/lib/auth";

type PagAvulsoProps = {
    id: number,
    valor: string | number
}

type PagEspecificoProps = {
    tipo: 'parcial' | 'total',
    id: Number,
    valor: Number | string
}

export async function pagamentoAvulso({ id, valor }: PagAvulsoProps) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('token')?.value

        if (!token) return { success: false, error: "Não autenticado" };

        const secret = new TextEncoder().encode(process.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        const empresaId = Number(payload.empresa_id);
        const userId = Number(payload.user_id);
        const valorNumerico = Number(valor)

        const resultado = await prisma.$transaction(async (tx) => {
            const notasRowRaw = await tx.pedidos.findMany({
                where: {
                    id_cliente: Number(id),
                    empresa_id: Number(empresaId),
                },
                orderBy: [
                    { data: 'asc' },
                    { id: 'asc' } // Desempate obrigatório
                ]
            });
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
                            data: new Date()
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

            return { notasAtualizadasFull };
        }, { timeout: 10000 });

        const cliente = await prisma.clientes.findUnique({ where: { id: Number(id) }, select: { nome: true } });
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
            notaAtualizada: resultado.notasAtualizadasFull
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

export async function pagamentoEspecifico({ tipo, id, valor }: PagEspecificoProps) {

    const dados = await autenticar()

    if (!dados) {
        return {
            success: false,
            error: "Sessão expirada ou inválida"
        }
    }

    if (tipo === 'parcial') {

        try {
            const notaInfos = await prisma.pedidos.findFirst({
                where: {
                    id: Number(id)
                }
            })
            const emAberto = Number(notaInfos?.valor_inicial) - Number(notaInfos?.valor_abatido)

            if (emAberto < Number(valor)) {
                return {
                    success: false,
                    error: 'Valor informado maior do que valor devedor!'
                }
            }

            const notaAlterada = await prisma.pedidos.update({
                where: { id: Number(id) },
                data: {
                    valor_abatido: Number(notaInfos?.valor_abatido) + Number(valor)
                }
            })

            console.log(notaAlterada);


            return {
                success: true,
                notaAtualizada: {
                    ...notaAlterada,
                    valor_abatido: Number(notaAlterada.valor_abatido),
                    valor_inicial: Number(notaAlterada.valor_inicial)
                }
            };


        } catch (error: any) {
            return {
                success: false,
                error
            }

        }
    } else
        if (tipo === 'total') {

            console.log(tipo, id, Number(valor));

            try {

                const notasInfos = await prisma.pedidos.findFirst({
                    where: { id: Number(id) }
                })

                const updateNota = await prisma.pedidos.update({
                    where: {
                        id: Number(id)
                    },
                    data: {
                        valor_abatido: Number(notasInfos?.valor_abatido) + Number(valor),
                        valor_restante: 0
                    }
                })

                return {
                    success: true,
                    notaAtualizada: updateNota
                };
            } catch (error: any) {

                return {
                    success: false,
                    error
                };
            }
        }

}

export async function CobrarBack(id: number) {

    const clienteComNotas = await prisma.clientes.findFirst({
        where: { id: Number(id) },
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

    console.log(dadosDoCliente.whatsapp)

    return {
        mensagem,
        whatsapp: dadosDoCliente.whatsapp ?? null
    }
}


