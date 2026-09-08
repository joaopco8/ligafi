"use client";

import { formatPeriodo } from "@/lib/format";
import type { Gestao } from "@/lib/types";

export const TODAS = "todas";

export function TimelineGestoes({
  gestoes,
  ativa,
  onChange,
  contagem,
}: {
  gestoes: Gestao[];
  ativa: string;
  onChange: (id: string) => void;
  /** Quantidade de movimentos por gestão (e total em `todas`). */
  contagem: Record<string, number>;
}) {
  const itens = [
    { id: TODAS, titulo: "Todas", sub: `${gestoes.length} gestões` },
    ...gestoes.map((g) => ({ id: g.id, titulo: g.nome, sub: formatPeriodo(g.inicio, g.fim) })),
  ];

  return (
    <nav aria-label="Gestões" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ol className="relative flex min-w-max items-start gap-1">
        <span aria-hidden className="absolute left-4 right-4 top-[7px] h-px bg-white/15" />
        {itens.map((item) => {
          const selecionado = item.id === ativa;
          const atual = item.id !== TODAS && !gestoes.find((g) => g.id === item.id)?.fim;
          return (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => onChange(item.id)}
                aria-pressed={selecionado}
                className="group flex w-[6.75rem] flex-col items-start gap-2 rounded-xl px-1 pb-2 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className={`relative ml-3 grid h-[15px] w-[15px] place-items-center rounded-full ring-4 ring-mata transition-all ${
                    selecionado
                      ? "bg-palha"
                      : item.id === TODAS
                        ? "border-2 border-white/40 bg-mata"
                        : "bg-white/30 group-hover:bg-white/60"
                  }`}
                >
                  {atual && <span className="absolute -inset-1 animate-ping rounded-full bg-palha/30" />}
                </span>
                <span className="px-1">
                  <span className={`block text-xs font-semibold leading-tight ${selecionado ? "text-palha" : "text-white/85"}`}>
                    {item.titulo}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-white/45">
                    {item.sub} · {contagem[item.id] ?? 0}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
