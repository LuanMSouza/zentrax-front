"use client";
import { Button } from "@/componentes/Buttons";
import { useEffect, useState } from "react";
import Cookies from 'js-cookie';

export default function TopBar() {

    const [diasRestantes, setDiasRestantes] = useState(10)

    const [nome, setNome] = useState('');

    useEffect(() => {
        const usuarioLogado = localStorage.getItem('usuario');
        if (usuarioLogado) {
            try {
                const usuario = JSON.parse(usuarioLogado);
                setNome(usuario?.nome ?? '');
            } catch (e) {
                console.error("Erro ao ler dados do usuário", e);
            }
        }
    }, []);

    function sair() {
        localStorage.clear()
        Cookies.remove('token', { path: '/' });
        window.location.href = '/login';
    }

    return (
        <nav className={`bg-indigo-400 flex justify-between px-8 py-2 items-center shadow shadow-gray-600`}>

            <div className="gap-2 flex justify-center items-center">
                <p className="text-lg text-white font-semibold">
                    Bem vindo <span className="italic font-bold">{nome}</span> !!
                </p>
                {/* <Button texto="Editar informações" tipo="btn01" tamanho="m" corTexto="branco" /> */}
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
                    tipo="config" // Ou uma cor neutra
                    tamanho="m"
                    texto="" // Ou o ícone da biblioteca que você está usando
                />
                {/* <Button texto="Gerenciar usuarios" tipo="btn01" tamanho="m" corTexto="branco" /> */}
                {/* <Button texto="Gerenciar cobrança" tipo="btn01" tamanho="m" corTexto="branco" /> */}
                <Button texto="Sair" tipo="sair" tamanho="m" corTexto="branco" onClick={() => sair()} />
            </div>
        </nav >
    );
}