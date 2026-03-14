import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Titulo from "@/componentes/Titulo";

type ClienteEmAberto = {
    id: number;
    nome: string;
    total: string;
    quantidade_de_notas: number;
    mais_nova: string;
    mais_antiga: string;
}

type DetalhadoPops = {
    cliente: ClienteEmAberto;
    notas: any[]
    sair: () => void; // Dica: adicione uma função para fechar o modal
}

export default function ClienteDetalhado({ cliente, sair, notas }: DetalhadoPops) {
    if (!cliente) return null;

    function formatarValor(valor: string) {
        const valorNumerico = Number(valor);

        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valorNumerico);
    }

    function formatarData(isoString: string) {
        const date = new Date(isoString);
        const dia = String(date.getDate() + 1).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0'); // meses começam do 0
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }


    return (
        <Cortina onClick={sair}>
            <Container tamanho="mg">
                <Titulo cor="preto" texto={cliente.nome} />
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="g" corTexto="branco" />

                <div className="grid grid-cols-4 w-8/9 p-4 items-center justify-center gap-4">

                    <div className="bg-cyan-100  p-2 w-full border-3 rounded-2xl flex flex-col justify-center items-center border-cyan-400 shadow shadow-cyan-700">
                        <p className=" text-xl">Total em aberto:</p>
                        <p className="text-2xl font-bold">{formatarValor(cliente.total)}</p>
                    </div>

                    <Button maxw="full" texto="Pagamento" tipo="btn03" tamanho="g" corTexto="branco" />
                    <Button maxw="full" texto="Cobrar Cliente" tipo="btn03" tamanho="g" corTexto="branco" />

                    <div className="bg-cyan-100  p-2 w-full border-3 rounded-2xl flex flex-col justify-center items-center border-cyan-400 shadow shadow-cyan-700">
                        <p className=" text-xl">Notas em aberto:</p>
                        <p className="text-2xl font-bold">{cliente.quantidade_de_notas}</p>
                    </div>

                </div>

                <div className=" flex flex-col w-full gap-2 max-h-120 overflow-y-auto">
                    {notas.map((n) => {

                        let taPago = Number(n.valor_inicial) - Number(n.valor_abatido) === 0

                        const opacidades = {
                            pago: 'opacity-50',
                            aberto: 'opacity-100'
                        }


                        return (
                            <div className={` ${taPago ? opacidades.pago : opacidades.aberto} border p-2 px-7 rounded-2xl shadow shadow-cyan-500 
                            justify-between flex`}>

                                {/* esquerda */}
                                <div className=" flex flex-col justify-center">
                                    <p className="text-xl font-bold">{formatarValor(String(n.valor_inicial - n.valor_abatido))}</p>
                                    <p className=" italic text-gray-800">{n.descricao}</p>
                                    <p>{formatarData(n.data)}</p>
                                    {(Number(n.valor_abatido) > 0 && Number(n.valor_abatido) < Number(n.valor_inicial)) && (
                                        <div className="mt-2 text-sm text-gray-500">
                                            <hr className="border-gray-300 my-1" />
                                            <p>Valor inicial: {formatarValor(n.valor_inicial)}</p>
                                            <p>Já abatido: {formatarValor(n.valor_abatido)}</p> 
                                        </div>
                                    )}

                                </div>

                                {/* direita */}
                                {n.valor_inicial != n.valor_abatido && (
                                    <div className=" flex  justify-center flex-col w-fit gap-1">
                                        <Button maxw="full" texto="Registrar pagamento total" tipo="btn04" tamanho="m" corTexto="branco" />
                                        <Button maxw="full" texto="Registrar pagamento parcial" tipo="btn05" tamanho="m" corTexto="branco" />
                                    </div>

                                )}

                            </div>
                        )
                    })}
                </div>
            </Container>
        </Cortina >
    )
}