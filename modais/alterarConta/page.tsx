import { Button } from "@/componentes/Buttons";
import Container from "@/componentes/Container";
import Cortina from "@/componentes/cortina";
import Titulo from "@/componentes/Titulo";
import { FormEvent, useState } from "react";
import Swal from "sweetalert2";
import { AlterarUsuarioBack } from "./actions";



export default function AlterarUsuario({ usuario, sair, atualizar }: { usuario: any, sair: () => void, atualizar: (e: any) => void }) {

    console.log(usuario);


    const form = [
        { id: 1, label: 'Nome', name: 'nome', placeholder: 'Nome Completo...', tipoInput: 'text' },
        { id: 2, label: 'Usuario', name: 'usuario', placeholder: 'Nome de usuario...', tipoInput: 'text' },
        { id: 3, label: 'Senha', name: 'senha', placeholder: 'Senha temporária', tipoInput: 'password' },
        { id: 4, label: 'Confimar senha', name: 'senhaConfirm', placeholder: 'Confirmar senha temporária', tipoInput: 'password' },
    ]

    const [dados, setDados] = useState({
        id: usuario.id,
        nome: usuario.nome,
        usuario: usuario.usuario,
        senha: '',
        senhaConfirm: '',
        role: usuario.role
    });

    async function enviar(e: FormEvent) {
        e.preventDefault()

        if (!dados.nome || !dados.usuario) {
            return Swal.fire('Opa...', 'Todos os dados são obrigatórios!', 'warning');
        }

        if (dados.senha.trim() || dados.senhaConfirm.trim()) {
            if (dados.senha !== dados.senhaConfirm) {
                Swal.fire('Opa...', 'As senhas não coincidem!!', 'error')
                setDados({ ...dados, senha: '', senhaConfirm: '' });
                return
            }
        }

        const res = await AlterarUsuarioBack(dados)


        if (res.success || res.usuarioAlterado) {

            Swal.fire('Sucesso!!', 'Usuario alterado com sucesso!!', 'success')
            atualizar(res.usuarioAlterado)
            sair()

        } else if (!res.success) {
            Swal.fire('Opa...', res.error as string, 'error')
        }
    }


    return (
        <Cortina onClick={sair}>
            <Container tamanho="p">
                <Titulo texto="Alterar Usuario!" cor="preto" />
                <Button tamanho="p" texto="X" tipo="fechar" corTexto="branco" onClick={sair} />

                <form onSubmit={enviar} className="flex flex-col w-full pb-4  px- items-center gap-2">
                    {form.map((i) => {
                        return (
                            <label key={i.id} className="flex flex-col text-cyan-800 font-bold text-xl items-center"> {i.label}
                                <input
                                    className="border border-gray-400 rounded-2xl text-gray-900 font-normal p-1 px-3 text-base outline-0"
                                    name={i.name}
                                    placeholder={i.placeholder}
                                    type={i.tipoInput}
                                    value={dados[i.name as keyof typeof dados]}
                                    onChange={e => setDados({ ...dados, [i.name]: e.target.value })}
                                />
                            </label>
                        )
                    })}

                    <label className="flex flex-col text-cyan-800 font-bold text-xl items-center">Role
                        <select
                            value={dados.role}
                            className="border border-gray-400 rounded-2xl text-gray-900 font-normal p-1 px-3 text-base outline-0 mb-6"
                            onChange={(e) => setDados({ ...dados, role: e.target.value })}
                        >
                            <option value="usuario">Usuario</option>
                            <option value="gestor">Gestor</option>
                        </select>
                    </label>


                    <Button texto="Alterar!" funcao="submit" corTexto="branco" tamanho="g" tipo="btn03" />

                </form>
            </Container>
        </Cortina>
    )
}