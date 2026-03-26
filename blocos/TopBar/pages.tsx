"use client";

import { Button } from "@/componentes/Buttons";
import { useEffect, useState } from "react";
import { logout } from "./actions";
import Configuracoes from "@/modais/configuracoes/page";

export default function TopBar() {

    const [usuario, setUsuario] = useState<any>({});
    const [empresa, setEmpresa] = useState<any>({});
    const [nome, setNome] = useState("");
    const [diasRestantes, setDiasRestantes] = useState(10);

    useEffect(() => {
        const userSalvo = localStorage.getItem('usuario');
        const empresaSalva = localStorage.getItem('empresa');

        if (userSalvo) {
            try {
                const parsedUser = JSON.parse(userSalvo);
                setUsuario(parsedUser);
                setNome(parsedUser?.nome ?? '');
            } catch (e) { console.error(e); }
        }

        if (empresaSalva) {
            try {
                setEmpresa(JSON.parse(empresaSalva));
            } catch (e) { console.error(e); }
        }
    }, []);

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

    return (
        <>
            <nav className={`bg-indigo-400 flex justify-between px-8 py-2 items-center shadow shadow-gray-600`}>

                <div className="gap-2 flex justify-center items-center">
                    <p className="text-lg text-white font-semibold">
                        Bem vindo <span className="italic font-bold">{nome}</span> !!
                    </p>
                </div>

                <div className="flex items-center gap-1">
                    <img className="h-8" src="/Logo.png" alt="Logo do Zentrax" />
                    <p className={`font-[TT_Milks] font-bold text-2xl`}>ZentraX</p>
                </div>

                <div className="gap-2 flex">
                    <div className="flex items-center justify-center flex-col">
                        <p className="text-sm italic text-gray-800">{diasRestantes} Dia(s) restante(s)</p>
                        <Button texto="Renovar agora" tipo="btn02" tamanho="p" corTexto="preto" />
                    </div>
                    <Button
                        corTexto="branco"
                        tipo="config"
                        tamanho="m"
                        texto=""
                        onClick={() => setConfig(true)}
                    />
                    <Button texto="Sair" tipo="sair" tamanho="m" corTexto="branco" onClick={() => sair()} />
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