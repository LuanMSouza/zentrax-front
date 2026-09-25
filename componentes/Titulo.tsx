type titulo = {
    texto: string,
    cor: 'branco' | 'preto'
}

export default function Titulo({ texto, cor }: titulo) {

    const cores = {
        branco: 'text-white',
        preto: 'text-slate-900'
    }

    return (
        <h1 className={`w-full pr-10 text-xl sm:text-2xl text-left font-semibold tracking-tight ${cores[cor]}`}>
            {texto}
        </h1 >
    )
}
