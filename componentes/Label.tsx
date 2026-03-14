type LabelProps = {
    children: React.ReactNode,
    texto: string,
    tamanho?: 'g' | 'a'
};

export default function Label({ children, texto, tamanho = 'g' }: LabelProps) {

    const tamanhos = {
        g: 'w-3/5',
        a: 'w-fit'
    }


    return (
        <label className={`flex flex-col gap-1 ${tamanhos[tamanho]} mx-auto`} >

            <p className="font-semibold text-slate-700 ml-1">
                {texto}
            </p>

            <div className="w-full">
                {children}
            </div>
        </label>
    )
}