export default function PreferenciasConfig() {
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Preferências do App</h2>
            <div className="flex items-center gap-3">
                <input type="checkbox" id="notif" className="accent-cyan-400 w-5 h-5" />
                <label htmlFor="notif">Receber notificações por e-mail</label>
            </div>
        </div>
    )
}