"use client"; // Só este arquivo é Client Component

export function Titlebar() {
    return (
        <div className="titlebar">
            <span className="text-xs opacity-70">ZentraX</span>
            <div className="window-controls">
                <button onClick={() => window.electron?.minimize()}>-</button>
                <button onClick={() => window.electron?.close()}>×</button>
            </div>
        </div>
    );
}