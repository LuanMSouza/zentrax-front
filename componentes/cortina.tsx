type CortinaProps = {
    children: React.ReactNode;
    onClick?: () => void; // O '?' torna a prop opcional
};

export default function Cortina({ children, onClick }: CortinaProps) {
    return (
        <div onClick={onClick} className="fixed top-0 left-0 w-full h-full bg-black/70">
            <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
                {children}
            </div>
        </div>
    )
}