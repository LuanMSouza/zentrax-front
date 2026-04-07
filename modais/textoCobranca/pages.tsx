import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import { useState } from "react";

interface MensagensPorCategoria {
    geral: number[];
    pet: number[];
}

interface Mensagem {
    id: number;
    msg?: string; // Interrogação porque do 2 ao 8 está vazio no seu exemplo
}

export default function TextoCobrancaConfig() {

    const empresaRaw = localStorage.getItem('empresa')
    const empresa = empresaRaw ? JSON.parse(empresaRaw) : null
    const segmento = (empresa?.segmento || 'geral') as keyof typeof mensagensAvaible
    // const segmento = ('pet') as keyof typeof mensagensAvaible


    const settingsRaw = localStorage.getItem('settings')
    const settings = settingsRaw ? JSON.parse(settingsRaw) : null
    const textoCobranca = Number(settings?.cobranca_text)

    const mensagens: Mensagem[] = [
        { id: 1, msg: 'Olá, **Nome** Tudo bem? Passando apenas para te lembrar da(s) nota(s) em aberto no valor de **Valor**. Consegue nos enviar o comprovante?' },
        { id: 2, msg: 'Olá, **Nome**. Consta em nosso sistema um em aberto de **Valor** referente a ${dadosDoCliente.quantidadeNotas} nota(s). Poderia nos encaminhar o comprovante?' },
        { id: 3, msg: 'Olá, **Nome**! Estamos organizando o fechamento financeiro e notamos **Quantidade de notas** nota(s) pendente(s) totalizando **Valor**.' },
        { id: 4, msg: 'Olá, **Nome**. O débito de **Valor** ainda não foi regularizado. Precisamos do comprovante hoje para evitar bloqueios.' },
        { id: 5, msg: 'Olá, **Nome**! 🐾 O fechamento da estadia do seu pet está pronto. O total de diárias e extras ficou em **Valor**. Consegue nos enviar o comprovante? Lambeijos! 🐶' },
        { id: 6, msg: 'Oi, **Nome**! Tudo bem? O relatório de diárias e extras do seu pet está pronto. Valor total: **Valor**. Qualquer dúvida sobre os itens, é só avisar! 🐾' },
        {
            id: 7, msg: `Olá, **Nome**! 🐾 Segue o fechamento: \n
            🐶 -Dog-: **Nome do cachorro**
            💰 Subtotal: Diarias x valor \n 
            ...(caso tenham mais registros) \n
            Consegue nos enviar o comprovante? 🐶
            `
        },
        {
            id: 8, msg: `Oi, **Nome**! Tudo certo? Resumo:\n
            - **Nome do cachorro**: **Valor**\n
            ...(caso tenham mais registros) \n
            Total: **Valor**. 🐾
                `
        },
    ]

    const mensagensAvaible: MensagensPorCategoria = {
        'geral': [1, 2, 3, 4],
        'pet': [5, 6, 7, 8]
    }

    const [mensagemSelecionada, setMensagemSelecionada] = useState<number | null>(textoCobranca)


    return (
        <Cortina>
            <Container tamanho="m">
                <p className="text-black text-4xl font-bold">Textos de cobrança</p>

                <div className="bg-white p-2 w-full grid grid-cols-2 gap-4 rounded-lg mt-2 ">

                    {mensagens.map((m) => {
                        if (!mensagensAvaible[segmento].includes(m.id)) return
                        return (

                            <div key={m.id} className="flex flex-col items-center m-auto w-full">
                                <label
                                    htmlFor={`msg-${m.id}`}
                                    className="bg-[#005c4b] cursor-pointer flex flex-col items-center p-2 rounded-lg rounded-br-none w-[80%] shadow-md">

                                    <input
                                        id={`msg-${m.id}`}
                                        type="radio"
                                        className="mb-2"
                                        name="msg"
                                        checked={mensagemSelecionada === m.id}
                                        onChange={() => setMensagemSelecionada(m.id)}
                                    />

                                    <span className="whitespace-pre-line text-white text-start px-2">
                                        {m.msg || `Mensagem ${m.id} - Em breve...`}
                                    </span>
                                </label>
                            </div>
                        )
                    })}
                </div>

                <button className="bg-[#005c4b] cursor-pointer text-white px-4 py-2 rounded-lg mt-4 shadow-md hover:bg-[#004d40] transition-colors">
                    Salvar
                </button>


            </Container>
        </Cortina>
    )

}