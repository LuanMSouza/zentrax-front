"use client";

import { Button } from "@/componentes/Buttons";
import { useEffect, useState } from "react";
import { logout } from "./actions";
import Configuracoes from "@/modais/configuracoes/page";
import Swal from "sweetalert2";
import { success } from "zod";

export default function TopBar() {

    const [usuario, setUsuario] = useState<any>({});
    const [empresa, setEmpresa] = useState<any>({});
    const [settings, setSettings] = useState<any>(null);
    const [nome, setNome] = useState("");
    const [diasRestantes, setDiasRestantes] = useState(0o0);

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
                        <p className="text-sm italic text-gray-800">{diasRestantes} Dia(s) restante(s)</p>

                        {diasRestantes < 10 &&
                            <Button onClick={naoHabilitado} texto="Renovar agora" tipo="btn02" tamanho="p" corTexto="preto" />
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
        </>
    );
}