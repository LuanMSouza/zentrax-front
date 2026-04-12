'use client'

import { Notas, ClienteEmAberto } from '@/types'


type BlocoProps = {
    clientes: ClienteEmAberto[],
    notas: Notas[],
    onClick: (e: ClienteEmAberto) => void,
    valor: boolean
}

export function BlocoClientes({ clientes, onClick, valor }: BlocoProps) {

    function formatarValor(valor: string) {
        const valorNumerico = Number(valor);

        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valorNumerico);
    }

    function formatarData(isoString: string) {
        const date = new Date(isoString);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0'); // meses começam do 0
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }

    return (
        <div className="w-full flex items-center justify-center gap-4 flex-wrap py-4 shadow-md shadow-gray-400 rounded-2xl ">
            {clientes.map(c => (
                <div
                    onClick={() => onClick(c)}
                    className="bg-white min-w-50 p-6 px-4 border border-gray-300 shadow-md shadow-gray-700 rounded-2xl w-2/9 cursor-pointer
                    duration-200 flex flex-col items-center justify-center hover:bg-blue-100 hover:scale-105 "
                    key={c.id}>

                    <p className="lg:text-2xl text-xl font-bold truncate ">{c.nome}</p>

                    <p className="text-sm m-1 italic opacity-70">
                        {valor ? c.quantidade_de_notas : '**'} nota(s)
                    </p>

                    <p className="lg:text-2xl text-xl gap-0 flex flex-col items-center lg:flex-row lg:gap-2 font-bold">
                        Valor:
                        <span>{valor ? formatarValor(c.total) : '******'}</span>
                    </p>

                    <div className="flex gap-1 pt-2">
                        {c.mais_antiga === c.mais_nova ? (
                            <p className="text-base font-bold text-blue-700">{formatarData(c.mais_antiga)}</p>
                        ) : (
                            <>
                                <p className="text-base font-bold text-red-700">{formatarData(c.mais_antiga)}</p>
                                <p className="text-base text-gray-600">-</p>
                                <p className="text-base font-bold text-green-700">{formatarData(c.mais_nova)}</p>
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}