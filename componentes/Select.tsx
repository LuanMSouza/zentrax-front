import React from "react"

type SelectProps = {
    children: React.ReactNode,
    value: string,
    onChange?: (e: string) => void,
    tamanho: 'p' | 'g'
}

export default function Selects({ children, value, onChange, tamanho }: SelectProps) {

    const tamanhos = {
        p: 'w-full sm:w-1/3',
        g: 'w-full'
    }

    return (
        <select
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className={`${tamanhos[tamanho]} bg-white rounded-lg ring-1 ring-slate-900/10 px-3.5 py-2.5 text-base text-left outline-none focus:ring-2 focus:ring-marca-700 transition-shadow cursor-pointer`}>
            {children}
        </select>
    )
}
