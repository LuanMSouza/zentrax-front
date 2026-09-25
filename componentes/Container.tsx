import React from "react";

type LayoutProps = {
    children: React.ReactNode;
    tamanho: 'g' | 'm' | 'mg' | 'p'
};

// 'g' = página inteira (não usado mais no dashboard); m/mg/p = caixas de modal.
// As caixas de modal não são mais `fixed`: quem centraliza e rola é a Cortina.
export default function Container({ children, tamanho }: LayoutProps) {

    const tamanhos = {
        g: 'w-11/12 max-w-7xl mx-auto my-4 p-4',
        m: 'relative w-full max-w-lg p-6 sm:p-8',
        mg: 'relative w-full max-w-3xl p-6 sm:p-8',
        p: 'relative w-full max-w-md p-6 sm:p-8'
    }

    return (
        <div className={`${tamanhos[tamanho]} flex flex-col items-stretch gap-4 bg-white rounded-2xl shadow-2xl shadow-marca-950/30`} >
            {children}
        </div>
    )
}
