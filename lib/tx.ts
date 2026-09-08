/**
 * Hashes fictícios de transação. Determinísticos a partir de uma semente,
 * no formato de uma assinatura Solana (88 caracteres base58).
 */

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function hashFicticio(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let x = h || 1;
  let out = "";
  for (let i = 0; i < 88; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out += BASE58[x % 58];
  }
  return out;
}

export function solscanUrl(hash: string, cluster: "mainnet" | "devnet" = "mainnet"): string {
  return cluster === "devnet"
    ? `https://solscan.io/tx/${hash}?cluster=devnet`
    : `https://solscan.io/tx/${hash}`;
}

export function truncarHash(hash: string, n = 6): string {
  return `${hash.slice(0, n)}…${hash.slice(-n)}`;
}
