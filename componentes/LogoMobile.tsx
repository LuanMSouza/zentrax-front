// Logo que só aparece no celular (o painel da marca é hidden lg:flex, então precisa de um substituto compacto).
export default function LogoMobile() {
    return (
        <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <img src="/Logo.png" alt="" className="h-9" />
            <span className="font-[TT_Milks] font-bold text-xl tracking-wide text-marca-950">ZentraX</span>
        </div>
    );
}
