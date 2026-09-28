import Image from 'next/image';
import { IconeCheck } from '@/componentes/Icones';

// Lado esquerdo compartilhado das telas de autenticação (login, esqueci a senha, redefinir senha):
// mesma identidade em todas, extraído do login pra não duplicar o painel inteiro em cada página.
export default function PainelMarca() {
    return (
        <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-marca-950 to-marca-700 text-white p-12 relative overflow-hidden z-10 shadow-[6px_0_24px_-8px_rgba(0,21,41,0.45)]">
            <div className="flex items-center gap-2.5">
                <img src="/Logo.png" alt="" className="h-9" />
                <span className="font-[TT_Milks] font-bold text-xl tracking-wide">ZentraX</span>
            </div>

            <div className="max-w-md">
                <h2 className="text-4xl font-semibold tracking-tight leading-[1.1] mb-5">
                    Chega de caderninho.<br />
                    <span className="text-cyan-300">Saiba quem te deve e quanto.</span>
                </h2>
                <ul className="space-y-2.5 text-slate-200">
                    {['Clientes e notas num lugar só', 'Cobrança pelo WhatsApp com a mensagem pronta', 'Baixa total ou parcial dos pagamentos'].map(t => (
                        <li key={t} className="flex items-start gap-2.5">
                            <IconeCheck className="w-5 h-5 mt-0.5 text-cyan-300 shrink-0" />
                            <span>{t}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="relative -mb-24 -mr-24 rounded-2xl overflow-hidden ring-1 ring-white/15 shadow-2xl shadow-black/40">
                <Image src="/preview-app-v2.png" alt="Tela do ZentraX com a lista de clientes e valores em aberto" width={1280} height={720} className="w-full h-auto" priority />
            </div>
        </aside>
    );
}
