"use client";

import { useEffect } from "react";

/** Overlay de confirmação com check animado. Fecha sozinho. */
export function ConfirmacaoOverlay({
  titulo,
  texto,
  tom = "palha",
  duracaoMs = 1600,
  onFim,
}: {
  titulo: string;
  texto?: string;
  tom?: "palha" | "entrada";
  duracaoMs?: number;
  onFim: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onFim, duracaoMs);
    return () => clearTimeout(t);
  }, [duracaoMs, onFim]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-mata/70 backdrop-blur-[2px]"
    >
      <div className="animate-pop flex flex-col items-center gap-3 rounded-3xl bg-mata-card px-8 py-7 shadow-2xl">
        <span className={`grid h-16 w-16 place-items-center rounded-full ${tom === "entrada" ? "bg-entrada" : "bg-palha"}`}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#0F3D2E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="40"
              className="animate-draw"
            />
          </svg>
        </span>
        <p className="font-display text-lg font-semibold">{titulo}</p>
        {texto && <p className="max-w-[16rem] text-center text-sm text-white/60">{texto}</p>}
      </div>
    </div>
  );
}
