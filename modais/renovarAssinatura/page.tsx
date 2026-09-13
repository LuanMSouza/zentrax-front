'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import Cortina from "@/componentes/cortina";
import { FormatarValor } from "@/lib/mask";
import { listarPlanos, criarSessaoRenovacao } from "@/blocos/TopBar/actions";
import type { PlanoId } from "@/lib/planos";

type Plano = {
    id: PlanoId;
    nome: string;
    dias: number;
    valorCentavos: number;
};

type RenovarAssinaturaProps = {
    sair: () => void;
    naoConfigurado: () => void;
};

const BENEFICIOS = [
    'Acesso completo ao painel',
    'Suporte via WhatsApp',
    'Todas as atualizações inclusas',
];

function Check() {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
        </svg>
    );
}

export default function RenovarAssinatura({ sair, naoConfigurado }: RenovarAssinaturaProps) {
    const [planos, setPlanos] = useState<Plano[]>([]);
    const [selecionado, setSelecionado] = useState<PlanoId | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [processando, setProcessando] = useState(false);

    useEffect(() => {
        (async () => {
            const lista = await listarPlanos();
            setPlanos(lista);
            setSelecionado(lista.find(p => p.id === 'anual')?.id ?? lista[0]?.id ?? null);
            setCarregando(false);
        })();
    }, []);

    const mensal = planos.find(p => p.id === 'mensal');

    function economiaPercentual(plano: Plano) {
        if (!mensal || plano.id === 'mensal') return 0;
        const custoProporcionalAoMensal = (mensal.valorCentavos / mensal.dias) * plano.dias;
        const economia = 1 - (plano.valorCentavos / custoProporcionalAoMensal);
        return Math.round(economia * 100);
    }

    async function confirmar() {
        if (!selecionado) return;

        setProcessando(true);
        const result = await criarSessaoRenovacao(selecionado);

        if (!result.success || !result.url) {
            setProcessando(false);

            if (result.error === 'not_configured') {
                sair();
                naoConfigurado();
                return;
            }

            Swal.fire('Opa...', result.error || 'Não foi possível iniciar o pagamento', 'error');
            return;
        }

        window.location.href = result.url;
    }

    return (
        <Cortina onClick={sair}>
            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="relative w-11/12 max-w-3xl my-8 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl shadow-black/40 bg-white"
            >
                <button
                    onClick={sair}
                    aria-label="Fechar"
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                    ✕
                </button>

                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-8 text-center">
                    <img src="/Logo.png" alt="Logo ZentraX" className="w-12 h-12 mx-auto mb-2 rounded-lg bg-white/90 p-1" />
                    <h2 className="text-2xl md:text-3xl font-bold text-white">Renovar assinatura</h2>
                    <p className="text-indigo-100 mt-1 text-sm md:text-base">Continue com o painel completo do seu negócio, sem interrupção.</p>
                </div>

                <div className="p-5 md:p-8 bg-gray-50">
                    {carregando ? (
                        <div className="flex justify-center py-10">
                            <div className="flex flex-row gap-2">
                                <div className="w-4 h-4 rounded-full bg-indigo-400 animate-bounce"></div>
                                <div className="w-4 h-4 rounded-full bg-indigo-400 animate-bounce [animation-delay:-.3s]"></div>
                                <div className="w-4 h-4 rounded-full bg-indigo-400 animate-bounce [animation-delay:-.5s]"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-3 gap-4">
                            {planos.map((plano) => {
                                const destaque = plano.id === 'anual';
                                const economia = economiaPercentual(plano);
                                const ativo = selecionado === plano.id;

                                return (
                                    <button
                                        key={plano.id}
                                        onClick={() => setSelecionado(plano.id)}
                                        className={`relative text-left flex flex-col gap-3 p-5 rounded-2xl border-2 bg-white transition-all cursor-pointer
                                            ${ativo ? 'border-indigo-500 shadow-lg shadow-indigo-200 -translate-y-1' : 'border-gray-200 hover:border-gray-300'}
                                        `}
                                    >
                                        {destaque && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-xs font-bold px-3 py-1 rounded-full shadow whitespace-nowrap">
                                                Melhor escolha
                                            </span>
                                        )}

                                        <div className="flex items-center justify-between mt-2">
                                            <span className="font-bold text-gray-800 text-lg">{plano.nome}</span>
                                            {economia > 0 && (
                                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                    -{economia}%
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <span className="text-3xl font-extrabold text-gray-900">{FormatarValor(plano.valorCentavos / 100)}</span>
                                            <span className="text-gray-500 text-sm"> / {plano.dias} dias</span>
                                        </div>

                                        <ul className="flex flex-col gap-1.5 mt-1">
                                            {BENEFICIOS.map((b) => (
                                                <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                                                    <span className="text-emerald-500"><Check /></span>
                                                    {b}
                                                </li>
                                            ))}
                                        </ul>

                                        <div className={`mt-2 w-full text-center text-sm font-semibold py-1.5 rounded-lg border-2
                                            ${ativo ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-200 text-gray-500'}
                                        `}>
                                            {ativo ? 'Selecionado' : 'Selecionar'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-3 mt-6">
                        <button
                            onClick={confirmar}
                            disabled={!selecionado || carregando || processando}
                            className="w-full md:w-auto md:px-16 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg
                                cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {processando ? 'Preparando pagamento...' : 'Ir para pagamento seguro'}
                        </button>
                        <p className="text-xs text-gray-500">🔒 Pagamento processado com segurança pelo Stripe</p>
                    </div>
                </div>
            </motion.div>
        </Cortina>
    );
}
