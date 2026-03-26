'use client'

import { Button } from "@/componentes/Buttons";
import Cortina from "@/componentes/cortina";
import { useState } from "react";
import PerfilConfig from "./abas/perfil";
import ContaConfig from "./abas/conta";
import PreferenciasConfig from "./abas/preferencias";

type ConfigProps = {
    sair: () => void,
    usuario: {},
    empresa: {},
    atualizarPerfil: (e: any) => void
}

export default function Configuracoes({ sair, usuario, empresa, atualizarPerfil }: ConfigProps) {

    const [selecionado, setSelecionado] = useState("perfil")

    const tabBase = "cursor-pointer pb-2 px-4 text-lg transition-all duration-300 border-b-2"
    const tabAtiva = "border-cyan-400 text-cyan-400 font-bold"
    const tabInativa = "border-transparent text-gray-400 hover:text-gray-200"

    return (
        <Cortina onClick={sair} classname="flex z-50 items-center justify-center p-4">

            <div className="bg-[#1a1a1a] relative z-50 text-white shadow-2xl rounded-2xl p-6 px-20 w-fit  max-w-2xl mx-auto border border-gray-800">
                <Button onClick={sair} texto="X" tipo="fechar" tamanho="m" corTexto="branco" />
                <nav className="flex gap-8 border-b border-gray-700 mb-6">
                    <button
                        onClick={() => setSelecionado("perfil")}
                        className={`${tabBase} ${selecionado === "perfil" ? tabAtiva : tabInativa}`}
                    >
                        Perfil
                    </button>
                    <button
                        onClick={() => setSelecionado("conta")}
                        className={`${tabBase} ${selecionado === "conta" ? tabAtiva : tabInativa}`}
                    >
                        Conta
                    </button>
                    <button
                        onClick={() => setSelecionado("preferencias")}
                        className={`${tabBase} ${selecionado === "preferencias" ? tabAtiva : tabInativa}`}
                    >
                        Preferências
                    </button>
                </nav>

                <div className="min-h-50 animate-in fade-in duration-500">


                    {selecionado === "perfil" && (
                        <PerfilConfig
                            atualizar={atualizarPerfil}
                            usuario={usuario} />
                    )}

                    {selecionado === "conta" && (
                        <ContaConfig
                            usuario={usuario}
                            empresa={empresa}
                        />
                    )}

                    {selecionado === "preferencias" && (
                        <PreferenciasConfig />
                    )}
                </div>
            </div>



        </Cortina>
    )
}