"use client";

import dynamic from "next/dynamic";
import { Marca } from "@/components/ui";
import { CLUSTER, DEMO_MODE } from "@/lib/solana/config";

// O botão lê `window`/localStorage (autoConnect): só no cliente, sem SSR.
const HeaderWallet = dynamic(() => import("@/components/header-wallet").then((m) => m.HeaderWallet), {
  ssr: false,
  loading: () => (
    <span className="inline-flex h-[30px] w-36 animate-pulse rounded-full border border-white/10 bg-white/5" aria-hidden />
  ),
});

/** Selo de rede. Sempre visível: aqui não há stablecoin, é SOL de devnet. */
export function BadgeRede({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/55 ${className}`}
      title="Rede de testes. Valores em SOL; R$ é só uma estimativa."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-palha/80" />
      {CLUSTER} · SOL{DEMO_MODE ? " · demo" : ""}
    </span>
  );
}

export function TopBar() {
  return (
    <header className="mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Marca tamanho={32} />
        <BadgeRede className="hidden sm:inline-flex" />
      </div>
      <div className="flex items-center gap-2">
        <BadgeRede className="sm:hidden" />
        <HeaderWallet />
      </div>
    </header>
  );
}
