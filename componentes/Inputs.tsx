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
        m: 'w-2/5',
        g: 'w-full',
        a: 'w-fit'
    }
    return (

        <input
            className={`${tamanhos[tamanho]} border border-gray-400 rounded-xl text-xl p-1 px-4 text-center outline-0 shadow shadow-gray-500`}
            type={type}
            placeholder={placeholder}
            name={name}
            defaultValue={value}
            onChange={(e) => onChange?.(e.target.value)}
        />
    )
}