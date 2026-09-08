"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Buffer } from "buffer";
import { useMemo, type ReactNode } from "react";
import { RPC_URL, assertDevnet } from "@/lib/solana/config";
import "@solana/wallet-adapter-react-ui/styles.css";

// web3.js 1.x e o beet do Squads esperam Buffer global no browser.
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

/**
 * Providers do wallet adapter. Renderizam no servidor sem problema (os
 * adapters só tocam `window` depois de montar); quem precisa de
 * `ssr: false` é o botão, não o provider. `autoConnect` mantém a sessão
 * no reload (o adapter guarda o nome da carteira em localStorage).
 */
export function SolanaProvider({ children }: { children: ReactNode }) {
  assertDevnet();
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
