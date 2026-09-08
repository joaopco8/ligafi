/**
 * Configuração de rede. Devnet apenas — nunca mainnet.
 * Tudo aqui é público (NEXT_PUBLIC_*): nada de chaves privadas.
 */

export const CLUSTER = "devnet" as const;

export const RPC_PUBLICO_DEVNET = "https://api.devnet.solana.com";

/** RPC usado pelo app. Cai no público de devnet se a env não existir. */
export const RPC_URL: string = process.env.NEXT_PUBLIC_RPC_URL?.trim() || RPC_PUBLICO_DEVNET;

/** Modo demo: telas usam o store com dados fictícios (plano B para gravação). */
export const DEMO_MODE: boolean = (process.env.NEXT_PUBLIC_DEMO_MODE ?? "true").toLowerCase() === "true";

/** Multisig compartilhado (opcional). Sem ele, o endereço vem do localStorage após /setup. */
export const MULTISIG_ENV: string | undefined = process.env.NEXT_PUBLIC_MULTISIG_ADDRESS?.trim() || undefined;

/** Cotação fixa só para exibir "≈ R$" ao lado de SOL. Não é oráculo. */
export const BRL_POR_SOL: number = Number(process.env.NEXT_PUBLIC_BRL_POR_SOL) || 900;

export const LAMPORTS_POR_SOL = 1_000_000_000;

export function lamportsParaSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_POR_SOL;
}

export function solParaLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_POR_SOL);
}

export function solscanTx(sig: string): string {
  return `https://solscan.io/tx/${sig}?cluster=${CLUSTER}`;
}

export function solscanConta(endereco: string): string {
  return `https://solscan.io/account/${endereco}?cluster=${CLUSTER}`;
}

/** Garante que a URL de RPC nunca aponta para mainnet. */
export function assertDevnet(url: string = RPC_URL): void {
  if (/mainnet/i.test(url)) {
    throw new Error("LigaFi só roda em devnet. NEXT_PUBLIC_RPC_URL aponta para mainnet.");
  }
}
