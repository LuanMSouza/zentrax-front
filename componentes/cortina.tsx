type CortinaProps = {
    children: React.ReactNode;
    onClick?: () => void;
    classname?: string
};

// Fundo escurecido dos modais. Agora rola quando o conteúdo é maior que a tela
// (antes o Container era `fixed` e cortava o modal em celulares baixos) e o
// modal fica centralizado dentro de um wrapper com padding.
export default function Cortina({ children, onClick, classname }: CortinaProps) {
    return (
        <div onClick={onClick} role="dialog" aria-modal="true" className={`${classname ?? ''} fixed inset-0 z-50 overflow-y-auto bg-marca-950/60 backdrop-blur-[2px]`}>
            <div onClick={(e) => e.stopPropagation()} className="min-h-full w-full flex items-center justify-center p-4">
                {children}
            </div>
        </div>
    )
}
