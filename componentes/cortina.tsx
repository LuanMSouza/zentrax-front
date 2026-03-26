type CortinaProps = {
    children: React.ReactNode;
    onClick?: () => void;
    classname?: string
};

export default function Cortina({ children, onClick, classname }: CortinaProps) {
    return (
        <div onClick={onClick} className={`${classname} fixed top-0 left-0 w-full h-full bg-black/70`}>
            <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
                {children}
            </div>
        </div>
    )
}