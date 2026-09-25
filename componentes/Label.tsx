type LabelProps = {
    children: React.ReactNode,
    texto: string,
    tamanho?: 'g' | 'a'
};

export default function Label({ children, texto, tamanho = 'g' }: LabelProps) {

    const tamanhos = {
        g: 'w-full',
        a: 'w-fit'
    }

    return (
        <label className={`flex flex-col gap-1.5 ${tamanhos[tamanho]}`} >

            <p className="text-sm font-medium text-slate-700">
                {texto}
            </p>

            <div className="w-full">
                {children}
            </div>
        </label>
    )
}
