'use client'

import { Button } from "@/componentes/Buttons";
import { useState } from "react";

import { Pagamentos } from "@/types";

type PagamentoProps = {
    pagamentos: Pagamentos[],
    MostrarValor: boolean
}

export default function BlocoPagamentos({ pagamentos, MostrarValor }: PagamentoProps) {



    const [mostrando, setMostrando] = useState(4);
    const lista = pagamentos?.length;

    function formatarValor(valor: number) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }

    function aumentar() {
        if (mostrando + 4 < lista) {
            setMostrando(mostrando + 4);
        } else {
            setMostrando(lista);
        }
    }

    return (
        <>
            {MostrarValor ? (
                <div className="flex flex-col items-center w-full"> {/* Container para alinhar tudo */}
                    <div className="w-full  flex items-center justify-center gap-4 flex-wrap py-4 rounded-2xl">
                        {pagamentos.slice(0, mostrando).map(p => (
                            <div
                                className="bg-white min-w-full sm:min-w-35 p-2 px-4 border border-gray-300 shadow-md shadow-gray-700 rounded-2xl w-2/9 duration-200 flex flex-col items-center"
                                key={p.id}
                            >
                                <p className="lg:text-xl text-base font-semibold truncate">{p.clientes?.nome}</p>
                                <p className="text-sm italic text-gray-600">
                                    {new Date(p.data).toLocaleDateString('pt-BR')}
                                </p>                                <p className="text-xl font-semibold">{formatarValor(p.valor)}</p>
                            </div>
                        ))}
                    </div>

                    {mostrando >= lista ? (
                        <p className="text-2xl text-gray-500 italic font-bold">Não há mais pagamentos para exibir</p>
                    ) : (
                        <Button onClick={aumentar} texto="Ver mais" tipo='btn03' tamanho="gg" corTexto="branco" />
                    )}
                </div>
            ) : (
                <p className="text-2xl text-gray-500 italic font-bold">Valores ocultos</p>
            )}
        </>
    );
}