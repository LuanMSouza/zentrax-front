"use client";

import { IconeEngrenagem, IconeSair } from "@/componentes/Icones";
import { useEffect, useState } from "react";
import { logout } from "./actions";
import Configuracoes from "@/modais/configuracoes/page";
import HistoricoAtividades from "@/blocos/HistoricoAtividades/pages";
import AssinaturaModal from "@/modais/assinatura/pages";
import Swal from "sweetalert2";

export default function TopBar() {

    const [usuario, setUsuario] = useState<any>({});
    const [empresa, setEmpresa] = useState<any>({});
    const [settings, setSettings] = useState<any>(null);
    const [nome, setNome] = useState("");
    const [diasRestantes, setDiasRestantes] = useState<number | null>(null);

    // Carrega os dados salvos no login (antes disso, nada aqui era preenchido
    // e o aviso de vencimento nunca disparava).
    useEffect(() => {
        try {
            const usuarioSalvo = localStorage.getItem('usuario');
            const empresaSalva = localStorage.getItem('empresa');
            const settingsSalvas = localStorage.getItem('settings');

            if (usuarioSalvo) {
                const u = JSON.parse(usuarioSalvo);
                setUsuario(u);
                setNome(u.nome ?? "");
            }

            if (empresaSalva) {
                const e = JSON.parse(empresaSalva);
                setEmpresa(e);

                if (e.expiracao) {
                    const diffMs = new Date(e.expiracao).getTime() - Date.now();
                    setDiasRestantes(Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                }
            }

            if (settingsSalvas) {
                setSettings(JSON.parse(settingsSalvas));
            }
        } catch (error) {
            console.error('Erro ao carregar dados salvos do login:', error);
        }
    }, []);

    useEffect(() => {
        if (settings && diasRestantes !== null) {

            // Aviso de tela nova


            if (settings.avisar && diasRestantes <= 4 && diasRestantes > 0) {
                Swal.fire('Aviso!!', `Sua assinatura vence em ${diasRestantes} dias!`, 'warning');
            }
        }
    }, [diasRestantes, settings]);

    async function sair() {
        localStorage.clear()
        await logout();
        window.location.href = '/login';
    }

    // empresa.assinante vem do login (undefined em sessões antigas → cai no
    // comportamento anterior: só oferece renovar quando faltam < 10 dias)
    const emTeste = empresa?.assinante === false
    const mostrarAssinar = emTeste || (diasRestantes !== null && diasRestantes < 10)

    const [config, setConfig] = useState(false)
    const [assinatura, setAssinatura] = useState(false)

    const atualizarDadosPerfil = (res: any) => {
        const novoUsuario = res.usuarioNovo[0];

        setUsuario(novoUsuario);
        setNome(novoUsuario.nome);
        localStorage.setItem('usuario', JSON.stringify(novoUsuario));
    }

    return (
        <>
            <nav className="sticky top-0 z-40 bg-marca-950 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 shrink-0">
                        <img className="h-8" src="/Logo.png" alt="" />
                        <span className="hidden sm:inline font-[TT_Milks] font-bold text-white text-lg tracking-wide">ZentraX</span>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {nome && (
                            <span className="hidden md:block text-sm text-slate-300 truncate">
                                Olá, <span className="text-white font-medium">{nome}</span>
                            </span>
                        )}

                        {diasRestantes !== null && (
                            <span
                                className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                                    diasRestantes <= 4 ? 'bg-amber-400/20 text-amber-300' : 'bg-white/10 text-slate-200'
                                }`}
                            >
                                {emTeste ? 'Teste' : 'Plano'}: {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}
                            </span>
                        )}

                        {mostrarAssinar && (
                            <button
                                onClick={() => setAssinatura(true)}
                                className="bg-cyan-400 hover:bg-cyan-300 active:scale-[0.98] text-marca-950 text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer"
                            >
                                {emTeste ? 'Assinar' : 'Renovar'}
                            </button>
                        )}

                        <button
                            onClick={() => setConfig(true)}
                            aria-label="Configurações"
                            title="Configurações"
                            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400"
                        >
                            <IconeEngrenagem />
                        </button>
                        <button
                            onClick={() => sair()}
                            aria-label="Sair"
                            title="Sair"
                            className="flex items-center gap-1.5 p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400"
                        >
                            <IconeSair />
                            <span className="hidden sm:inline text-sm">Sair</span>
                        </button>
                    </div>
                </div>
            </nav>

            {config &&
                <Configuracoes
                    atualizarPerfil={atualizarDadosPerfil}
                    usuario={usuario}
                    empresa={empresa}
                    sair={() => setConfig(false)} />}

            {usuario?.role === 'gestor' && <HistoricoAtividades />}

            {assinatura && <AssinaturaModal sair={() => setAssinatura(false)} />}
        </>
    );
}