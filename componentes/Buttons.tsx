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
        btn01: "bg-marca-700 hover:bg-marca-800 duration-200 font-medium",
        // submit principal dos formulários/modais: antes verde-claro com texto cinza
        btn02: 'bg-marca-700 hover:bg-marca-800 duration-200 font-medium text-white!',
        btn03: 'bg-marca-700 hover:bg-marca-800 duration-200 font-medium',
        btn04: 'bg-emerald-600 hover:bg-emerald-700 duration-200 font-medium text-white!',
        btn05: 'bg-red-600 hover:bg-red-700 duration-200 font-medium text-white!',
        sair: "bg-white/10 hover:bg-white/20 duration-200 rounded-lg",
        fechar: "absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 duration-200",
        config: "bg-none hover:scale-110 hover:rotate-360 duration-5000"
    };

    const tamanhos = {
        p: "px-2.5 py-1 rounded-lg text-sm",
        m: "px-3 py-1.5 rounded-lg text-sm md:text-base",
        g: "px-4 py-2 rounded-lg text-sm md:text-base",
        gg: "px-6 py-2.5 rounded-lg text-base"
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
            aria-label={tipo === 'fechar' ? 'Fechar' : undefined}
            className={`${tamanhos[tamanho]}  ${tipo === 'fechar' ? '' : cores[corTexto]} m-0 ${Maxw[maxw]} ${tipos[tipo]}  cursor-pointer active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400`}>

            {tipo === 'sair' && <img src={'/saida.png'} alt="icon sair" className="md:h-6 h-5" />}
            {tipo === 'config' && <img src={'/config.png'} alt="icon sair" className="md:h-7 h-6" />}
            {tipo === 'fechar' && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            )}
            {(tipo !== 'config' && tipo !== 'sair' && tipo !== 'fechar') && texto}

        </button>
    )
}