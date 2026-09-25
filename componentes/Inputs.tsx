type InputProps = {
    placeholder: string,
    type: string,
    value?: string,
    onChange?: (e: string) => void,
    tamanho: 'm' | 'g' | 'a',
    name: string
}

export default function Input({ placeholder, type, value, onChange, tamanho, name }: InputProps) {

    const tamanhos = {
        m: 'w-full sm:w-2/5',
        g: 'w-full',
        a: 'w-fit'
    }
    return (

        <input
            className={`${tamanhos[tamanho]} bg-white rounded-lg ring-1 ring-slate-900/10 px-3.5 py-2.5 text-base text-left placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-marca-700 transition-shadow`}
            type={type}
            placeholder={placeholder}
            name={name}
            defaultValue={value}
            onChange={(e) => onChange?.(e.target.value)}
        />
    )
}
