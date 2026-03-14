import React from "react";

type LayoutProps = {
    children: React.ReactNode;
    tamanho: 'g' | 'm' | 'mg'
};

export default function Container({ children, tamanho }: LayoutProps) {

    const tamanhos = {
        g: 'w-11/12',
        m: 'w-7/12 fixed inset-0 m-auto h-fit',
        mg: 'w-10/12 fixed inset-0 m-auto h-fit'
    }

    return (
        <div className={`${tamanhos[tamanho]}  flex flex-col justify-center items-center gap-4 bg-white p-4 m-4 mx-auto rounded-lg shadow-md shadow-gray-600`} >
            {children}
        </div>
    )
}