type BtnProps = {
    texto: string,
    tipo: 'btn01' | 'btn02' | 'btn03' | 'btn04' | 'btn05' | 'sair' | 'fechar' | 'config',
    tamanho: 'p' | 'm' | 'g' | 'gg',
    corTexto: 'branco' | 'preto' | 'cinza',
    onClick?: React.MouseEventHandler<HTMLButtonElement>,
    funcao?: 'submit' | 'button' | 'reset',
    maxw?: 'fit' | 'full'
}

export function Button({ texto, tipo, tamanho, corTexto, onClick, funcao = 'button', maxw = 'fit' }: BtnProps) {

    const tipos = {
        btn01: "bg-blue-700 hover:bg-blue-900 duration-200",
        btn02: 'bg-emerald-300 hover:bg-emerald-400 duration-200',
        btn03: 'bg-cyan-700 hover:bg-cyan-900 duration-200',
        btn04: 'bg-green-700 hover:bg-green-500 duration-200 font-bold',
        btn05: 'bg-red-800 hover:bg-red-500 duration-200 font-bold ',
        sair: "bg-red-500 hover:bg-red-700 duration-200",
        fechar: "bg-red-500 hover:bg-red-700 absolute top-5 right-3 duration-200",
        config: "bg-none hover:scale-110 hover:rotate-360 duration-5000"
    };

    const tamanhos = {
        p: "px-2 py-1 rounded-lg teFxt-sm",
        m: "px-4 py-1 rounded-lg text-base",
        g: "px-6 py-2 rounded-lg text-xl",
        gg: "px-8 py-3 rounded-lg text-2xl"
    }

    const cores = {
        branco: 'text-white',
        preto: 'text-black',
        cinza: 'text-gray-800',
    }

    const Maxw = {
        fit: 'max-w-fit',
        full: 'w-full'
    }

    return (
        <button
            type={funcao}
            onClick={onClick}
            className={`${tamanhos[tamanho]}  ${cores[corTexto]} m-0 ${Maxw[maxw]} ${tipos[tipo]}  cursor-pointer`}>

            {tipo === 'sair' && <img src={'/saida.png'} alt="icon sair" className="h-6" />}
            {tipo === 'config' && <img src={'/config.png'} alt="icon sair" className="h-7" />}
            {(tipo !== 'config' && tipo !== 'sair') && texto}

        </button>
    )
}