"use client";

import { useEffect, useState } from "react";

export function Titlebar() {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        if (document.documentElement.classList.contains("is-electron")) {
            setIsElectron(true);
        }
    }, []);

    if (!isElectron) return null;

    return (
        <div className="flex justify-between px-5 py-2 bg-purple-700">
            <span className="text-base text-blue-100 font-bold">ZentraX</span>
            <div className="window-controls">
                <button className="text-xl h-7 w-7 bg-white flex justify-center items-center rounded-3xl cursor-pointer text-purple-700" onClick={() => window.electron?.minimize()}>-</button>

                <button
                    className="text-sm font-bold h-7 w-7 bg-white flex justify-center items-center rounded-3xl cursor-pointer text-purple-700"
                    onClick={() => window.electron?.maximize()}>▢</button>

                <button className="text-xl h-7 w-7 bg-white flex justify-center items-center rounded-3xl cursor-pointer text-purple-700" onClick={() => window.electron?.close()}>×</button>
            </div>
        </div>
    );
}