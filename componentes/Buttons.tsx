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
        sair: "bg-red-500 hover:bg-red-700 duration-200 ",
        fechar: "bg-red-500 hover:bg-red-700 absolute top-3 right-1 duration-200 ",
        config: "bg-none hover:scale-110 hover:rotate-360 duration-5000"
    };

    const tamanhos = {
        p: "px-1 py-0.5 rounded-lg text-sm md:px-2 md:py-1",
        m: "px-2 py-0.5  md:px-4 md:py-1 rounded-lg md:text-base text-sm",
        g: "md:px-6 px-2 py-1 rounded-lg text-base  md:text-xl",
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

            {tipo === 'sair' && <img src={'/saida.png'} alt="icon sair" className="md:h-6 h-5" />}
            {tipo === 'config' && <img src={'/config.png'} alt="icon sair" className="md:h-7 h-6" />}
            {(tipo !== 'config' && tipo !== 'sair') && texto}

        </button>
    )
}