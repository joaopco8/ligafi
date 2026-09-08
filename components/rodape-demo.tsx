"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLigaFi } from "@/lib/store";

const OCULTAR_EM = ["/", "/entrar"];

export function RodapeDemo() {
  const pathname = usePathname();
  const reset = useLigaFi((s) => s.reset);
  const [feito, setFeito] = useState(false);

  if (OCULTAR_EM.includes(pathname)) return null;

  function handleReset() {
    if (!window.confirm("Apagar os dados desta demo e voltar ao estado inicial?")) return;
    reset();
    setFeito(true);
    setTimeout(() => setFeito(false), 1500);
  }

  return (
    <div className="mt-6 flex justify-center">
      <button
        type="button"
        onClick={handleReset}
        className="text-[11px] text-white/25 underline-offset-4 transition-colors hover:text-white/60 hover:underline"
      >
        {feito ? "demo reiniciada" : "resetar demo"}
      </button>
    </div>
  );
}
