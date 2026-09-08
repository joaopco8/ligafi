"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import { BRL_POR_SOL, lamportsParaSol } from "@/lib/solana/config";
import { useLigaFi } from "@/lib/store";

function truncar(e: string, n = 4): string {
  return `${e.slice(0, n)}…${e.slice(-n)}`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Saldo em SOL da carteira conectada, com assinatura de mudanças. */
export function useSaldoSol() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setSaldo(null);
      return;
    }
    let ativo = true;
    const ler = () =>
      connection
        .getBalance(publicKey, "confirmed")
        .then((l) => ativo && (setSaldo(lamportsParaSol(l)), setErro(false)))
        .catch(() => ativo && setErro(true));
    ler();
    const sub = connection.onAccountChange(publicKey, (info) => setSaldo(lamportsParaSol(info.lamports)), "confirmed");
    const t = setInterval(ler, 30_000);
    return () => {
      ativo = false;
      clearInterval(t);
      connection.removeAccountChangeListener(sub).catch(() => {});
    };
  }, [connection, publicKey]);

  return { saldo, erro };
}

export function HeaderWallet() {
  const { publicKey, wallet, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { saldo, erro } = useSaldoSol();
  const conectarCarteira = useLigaFi((s) => s.conectarCarteira);
  const desconectarCarteira = useLigaFi((s) => s.desconectarCarteira);
  const carteiraStore = useLigaFi((s) => s.carteira);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Espelha a carteira do adapter no store (usado pelo painel e, na Fase 2, pelo auth).
  useEffect(() => {
    if (publicKey && wallet) {
      const endereco = publicKey.toBase58();
      if (carteiraStore?.endereco !== endereco) {
        conectarCarteira({ provedor: wallet.adapter.name.toLowerCase(), nome: wallet.adapter.name, endereco, rede: "solana" });
      }
    } else if (!connecting && carteiraStore && carteiraStore.rede !== "demo") {
      desconectarCarteira();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, wallet, connecting]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="inline-flex items-center gap-2 rounded-full border border-palha/50 px-3 py-1.5 text-xs font-medium text-palha transition-colors hover:bg-palha/10 disabled:opacity-60"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
        {connecting ? "Conectando…" : "Conectar carteira"}
      </button>
    );
  }

  const endereco = publicKey.toBase58();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 rounded-full border border-entrada/40 bg-entrada/[0.06] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-entrada/70"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-entrada" />
        <span className="tabular">{truncar(endereco)}</span>
        <span className="tabular text-white/60">
          {erro ? "—" : saldo === null ? "…" : `◎ ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}`}
        </span>
      </button>

      {aberto && (
        <div className="absolute right-0 z-30 mt-2 w-64 animate-fadeUp rounded-2xl border border-white/10 bg-mata-card p-3 shadow-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">{wallet?.adapter.name}</p>
          <code className="mt-1 block break-all text-[11px] leading-relaxed text-white/70">{endereco}</code>
          <div className="mt-3 flex items-baseline justify-between border-t border-white/[0.06] pt-3">
            <span className="text-xs text-white/55">Saldo</span>
            <span className="text-right">
              <span className="tabular block font-display text-lg font-semibold text-palha">
                ◎ {saldo === null ? "…" : saldo.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
              </span>
              {saldo !== null && (
                <span className="tabular block text-[11px] text-white/45">≈ {brl.format(saldo * BRL_POR_SOL)}</span>
              )}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setVisible(true);
              }}
              className="flex-1 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:border-white/40"
            >
              Trocar carteira
            </button>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                disconnect().catch(() => {});
              }}
              className="flex-1 rounded-xl border border-saida/40 px-3 py-2 text-xs font-medium text-saida hover:bg-saida/10"
            >
              Desconectar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
