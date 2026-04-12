type titulo = {
    texto: string,
    cor: 'branco' | 'preto'
}

export default function Titulo({ texto, cor }: titulo) {

    const cores = {
        branco: 'text-white',
        preto: ' text-black'
    }

    return (
        <h1 className={`md:text-4xl text-2xl text-center font-bold ${cores[cor]}`}>
            {texto}
        </h1 >
    )
}