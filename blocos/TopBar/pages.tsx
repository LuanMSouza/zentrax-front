"use client";

import { Button } from "@/componentes/Buttons";
import { useEffect, useState } from "react";
import { logout, criarSessaoRenovacao, listarPlanos } from "./actions";
import Configuracoes from "@/modais/configuracoes/page";
import HistoricoAtividades from "@/blocos/HistoricoAtividades/pages";
import Swal from "sweetalert2";
import { FormatarValor } from "@/lib/mask";
import type { PlanoId } from "@/lib/planos";

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

    const [config, setConfig] = useState(false)

    const atualizarDadosPerfil = (res: any) => {
        const novoUsuario = res.usuarioNovo[0];

        setUsuario(novoUsuario);
        setNome(novoUsuario.nome);
        localStorage.setItem('usuario', JSON.stringify(novoUsuario));
    }

    const naoHabilitado = () => {
        Swal.fire({
            title: 'Ops...',
            html: `
    <p style="margin-bottom: 10px;">Essa função ainda não foi habilitada</p>
    <a
        href="https://wa.me/5513998087787?text=Olá,%20gostaria%20de%20renovar%20minha%20assinatura"
        target="_blank"
        class="inline-block bg-cyan-300 px-4 py-2 rounded-2xl text-black font-semibold no-underline"
    >
        Clique aqui para entrar em contato direto com o administrador!
    </a>
`,
            icon: 'warning'
        })
    }

    const renovar = async () => {
        const planos = await listarPlanos();

        const cardsHtml = planos.map((plano) => {
            const destaque = plano.id === 'anual';

            return `
                <label class="relative flex items-center justify-between gap-3 border-2 ${destaque ? 'border-emerald-400' : 'border-gray-300'} rounded-xl p-3 mb-2 cursor-pointer hover:bg-gray-50 text-left">
                    ${destaque ? '<span class="absolute -top-2.5 right-3 bg-emerald-400 text-black text-xs font-bold px-2 py-0.5 rounded-full shadow">Melhor escolha</span>' : ''}
                    <span class="flex items-center gap-3">
                        <input type="radio" name="plano-renovacao" value="${plano.id}" class="w-4 h-4 accent-emerald-500" />
                        <span>
                            <span class="block font-semibold text-gray-800">${plano.nome}</span>
                            <span class="block text-xs text-gray-500">${plano.dias} dias</span>
                        </span>
                    </span>
                    <span class="font-bold text-gray-800">${FormatarValor(plano.valorCentavos / 100)}</span>
                </label>
            `;
        }).join('');

        const { value: planoEscolhido } = await Swal.fire<PlanoId>({
            title: 'Renovar assinatura',
            html: `<div class="text-left">${cardsHtml}</div>`,
            icon: 'question',
            confirmButtonText: 'Ir para pagamento',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const selecionado = document.querySelector<HTMLInputElement>('input[name="plano-renovacao"]:checked');
                if (!selecionado) {
                    Swal.showValidationMessage('Escolha um plano para continuar');
                    return false;
                }
                return selecionado.value as PlanoId;
            },
        });

        if (!planoEscolhido) return;

        Swal.fire({ title: 'Preparando pagamento...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        const result = await criarSessaoRenovacao(planoEscolhido);

        if (!result.success || !result.url) {
            Swal.close();

            if (result.error === 'not_configured') {
                naoHabilitado();
                return;
            }

            Swal.fire('Opa...', result.error || 'Não foi possível iniciar o pagamento', 'error');
            return;
        }

        window.location.href = result.url;
    }



    return (
        <>
            <nav className={`bg-indigo-400 flex justify-between px-8 py-2 items-center shadow shadow-gray-600`}>

                <div className="hidden gap-2 sm:flex sm:justify-center sm:items-center">
                    <p className="flex flex-col items-center lg:flex-row md:text-lg text-white font-semibold gap-2 text-sm">
                        Bem vindo <span className="italic font-bold">{nome} !!</span>
                    </p>
                </div>

                <div className=" flex flex-col lg:flex-row items-center gap-1">
                    <img className="h-7 md:h-10 " src="/Logo.png" alt="Logo do Zentrax" />
                    <p className={`font-[TT_Milks] font-bold text-sm md:text-xl`}>ZentraX</p>
                </div>

                <div className="gap-2 flex">
                    <div className="flex items-center justify-center flex-col">
                        <p className="text-sm italic text-gray-800">{diasRestantes ?? '--'} Dia(s) restante(s)</p>

                        {diasRestantes !== null && diasRestantes < 10 &&
                            <Button onClick={renovar} texto="Renovar agora" tipo="btn02" tamanho="p" corTexto="preto" />
                        }
                    </div>

                    <div className="ml-2 flex flex-col-reverse gap-1 lg:flex-row">
                        <Button
                            corTexto="branco"
                            tipo="config"
                            tamanho="m"
                            texto=""
                            onClick={() => setConfig(true)}
                        />
                        <Button texto="Sair" tipo="sair" tamanho="m" corTexto="branco" onClick={() => sair()} />
                    </div>
                </div>
            </nav >

            {config &&
                <Configuracoes
                    atualizarPerfil={atualizarDadosPerfil}
                    usuario={usuario}
                    empresa={empresa}
                    sair={() => setConfig(false)} />}

            {usuario?.role === 'gestor' && <HistoricoAtividades />}
        </>
    );
}