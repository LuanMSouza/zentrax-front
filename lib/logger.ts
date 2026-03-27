import prisma from "./prisma";

type Log = {
    tabela: 'Pagamentos' | 'Clientes' | 'Pedidos' | string,
    operacao: string,
    empresa_id: number, // Use minúsculo
    usuario_id: number  // Use minúsculo
}

export default async function RegistrarAcao({ tabela, operacao, empresa_id, usuario_id }: Log) {
    try {
        await prisma.alteracoes.create({
            data: {
                tabela: tabela,
                operacao: operacao,
                empresa: Number(empresa_id),
                usuario: Number(usuario_id)
            }
        });

        return { mensagem: 'Registrado com sucesso!', success: true };
    } catch (error: any) {
        console.error("Erro ao registrar log:", error.message);
        return { mensagem: error.message || "Erro desconhecido", success: false };
    }
}