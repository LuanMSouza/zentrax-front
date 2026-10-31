type CortinaProps = {
    children: React.ReactNode;
    onClick?: () => void;
    classname?: string
};

// Fundo escurecido dos modais. Um div só (fixed + centraliza o conteúdo), fecha ao clicar em QUALQUER ponto vazio
// dele — inclusive nas bordas ao lado do card, não só na faixa escura visível. Checa target === currentTarget em
// vez de stopPropagation no filho: a versão antiga tinha um wrapper interno ocupando a tela inteira (mesmo
// tamanho do overlay) só pra centralizar o card, então TODO clique caía nele primeiro e nunca chegava no
// onClick do fundo — o "fechar ao clicar fora" nunca funcionou em nenhum modal do app.
// Centraliza com my-auto no filho, não items-center: com items-center, modal mais alto que a tela (celular)
// tinha o topo cortado sem dar pra rolar até ele.
export default function Cortina({ children, onClick, classname }: CortinaProps) {
    return (
        <div
            onClick={(e) => { if (e.target === e.currentTarget) onClick?.() }}
            role="dialog"
            aria-modal="true"
            className={`${classname ?? ''} fixed inset-0 z-50 overflow-y-auto bg-marca-950/60 backdrop-blur-[2px] flex items-start justify-center p-4 sm:py-10 [&>*]:my-auto`}
        >
            {children}
        </div>
    )
}
