import React from "react"

type SelectProps = {
    children: React.ReactNode,
    value: string,
    onChange?: (e: string) => void,
    tamanho: 'p' | 'g'
}

export default function Selects({ children, value, onChange, tamanho }: SelectProps) {

    const tamanhos = {
        p: 'lg:w-1/5  ',
        g: 'w-full'
    }

    return (
        <select
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className={`${tamanhos[tamanho]} border border-gray-400 rounded-xl text-xl p-1 px-4 text-center outline-0 shadow shadow-gray-500`}>
            {children}
        </select>
    )
}