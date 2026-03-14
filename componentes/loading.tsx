import Cortina from "./cortina"

type LoadingProps = {
    ativo: boolean
}

export default function Loading({ ativo }: LoadingProps) {

    if (ativo) {
        return (
            <>
                <Cortina>

                    <div className="flex flex-row gap-2 fixed inset-0 m-auto h-fit w-fit z-100">
                        <div className="w-6 h-6 rounded-full bg-indigo-400 animate-bounce"></div>
                        <div className="w-6 h-6 rounded-full bg-indigo-400 animate-bounce [animation-delay:-.3s]"></div>
                        <div className="w-6 h-6 rounded-full bg-indigo-400 animate-bounce [animation-delay:-.5s]"></div>
                    </div>

                </Cortina >
            </>
        )
    } else {
        return (null)
    }


}