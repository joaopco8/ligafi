/**
 * Histórico do Vault (extrato público on-chain).
 *
 * Duas fontes, mesma saída:
 *   - Helius Enhanced Transactions (devnet) quando há HELIUS_API_KEY
 *   - Fallback web3.js: getSignaturesForAddress + getParsedTransactions
 *
 * Cada movimento traz assinatura real, delta de lamports do vault,
 * contraparte, memo "LigaFi:<descricao>|<categoria>" quando existir.
 * Puro (sem React); roda no servidor (route handler) ou em scripts.
 */

import { Connection, PublicKey, type ParsedInstruction, type ParsedTransactionWithMeta, type PartiallyDecodedInstruction } from "@solana/web3.js";
import { lerMemoLigaFi, MEMO_PROGRAM_ID, PROGRAM_ID as SQUADS_PROGRAM_ID } from "./squads";

export interface MovimentoOnChain {
  sig: string;
  slot: number;
  /** Unix seconds. */
  timestamp: number | null;
  tipo: "entrada" | "saida";
  lamports: number;
  contraparte?: string;
  memo?: string;
  descricao: string;
  categoria: string;
  /** Saída executada pelo multisig (CPI do Squads). */
  viaMultisig: boolean;
  falhou: boolean;
}

export interface PaginaHistorico {
  movimentos: MovimentoOnChain[];
  /** Assinatura mais antiga da página; passe em `antesDe` para a próxima. */
  proximoCursor: string | null;
  fonte: "helius" | "rpc";
}

// ---------------------------------------------------------------------------
// base58 (só decode, para memos vindos do Helius)
// ---------------------------------------------------------------------------

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function decodeBase58(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) throw new Error("base58 inválido");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function descricaoDe(memo: string | undefined, tipo: "entrada" | "saida", viaMultisig: boolean): { descricao: string; categoria: string } {
  const lido = lerMemoLigaFi(memo);
  if (lido) return lido;
  if (memo && memo.trim()) return { descricao: memo.trim().slice(0, 120), categoria: "outros" };
  if (tipo === "entrada") return { descricao: "Depósito no cofre", categoria: "outros" };
  return { descricao: viaMultisig ? "Pagamento executado pelo cofre" : "Saída do cofre", categoria: "outros" };
}

// ---------------------------------------------------------------------------
// Fallback web3.js
// ---------------------------------------------------------------------------

function extrairMemoParsed(tx: ParsedTransactionWithMeta): string | undefined {
  const todas: (ParsedInstruction | PartiallyDecodedInstruction)[] = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions),
  ];
  for (const ix of todas) {
    if (!ix.programId.equals(MEMO_PROGRAM_ID)) continue;
    if ("parsed" in ix && typeof ix.parsed === "string") return ix.parsed;
    if ("data" in ix && typeof ix.data === "string") {
      try {
        return Buffer.from(decodeBase58(ix.data)).toString("utf8");
      } catch {
        /* ignora */
      }
    }
  }
  return undefined;
}

function contraparteParsed(tx: ParsedTransactionWithMeta, vault: string, tipo: "entrada" | "saida"): string | undefined {
  const todas: (ParsedInstruction | PartiallyDecodedInstruction)[] = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions),
  ];
  for (const ix of todas) {
    if (!("parsed" in ix) || ix.program !== "system") continue;
    const p = ix.parsed as { type?: string; info?: { source?: string; destination?: string } };
    if (p.type !== "transfer" || !p.info) continue;
    if (tipo === "saida" && p.info.source === vault) return p.info.destination;
    if (tipo === "entrada" && p.info.destination === vault) return p.info.source;
  }
  return undefined;
}

function converterParsed(sig: string, tx: ParsedTransactionWithMeta | null, vault: string): MovimentoOnChain | null {
  if (!tx || !tx.meta) return null;
  const chaves = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const idx = chaves.indexOf(vault);
  if (idx < 0) return null;
  const delta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
  if (delta === 0) return null; // ex.: criação de proposta não mexe no vault
  const tipo = delta > 0 ? "entrada" : "saida";
  const viaMultisig = chaves.includes(SQUADS_PROGRAM_ID.toBase58());
  const memo = extrairMemoParsed(tx);
  const { descricao, categoria } = descricaoDe(memo, tipo, viaMultisig);
  return {
    sig,
    slot: tx.slot,
    timestamp: tx.blockTime ?? null,
    tipo,
    lamports: Math.abs(delta),
    contraparte: contraparteParsed(tx, vault, tipo),
    memo,
    descricao,
    categoria,
    viaMultisig,
    falhou: tx.meta.err !== null,
  };
}

export async function lerHistoricoRpc(
  connection: Connection,
  vault: PublicKey,
  opts: { limite?: number; antesDe?: string } = {},
): Promise<PaginaHistorico> {
  const limite = Math.min(Math.max(opts.limite ?? 25, 1), 100);
  const sigs = await connection.getSignaturesForAddress(vault, { limit: limite, before: opts.antesDe }, "confirmed");
  if (sigs.length === 0) return { movimentos: [], proximoCursor: null, fonte: "rpc" };
  const txs = await connection.getParsedTransactions(
    sigs.map((s) => s.signature),
    { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  );
  const v = vault.toBase58();
  // O batch JSON-RPC pode voltar fora de ordem (visto no RPC público de
  // devnet): casa cada transação pela própria assinatura, nunca pelo índice.
  const porSig = new Map<string, ParsedTransactionWithMeta>();
  for (const t of txs) if (t) porSig.set(t.transaction.signatures[0], t);
  const movimentos = sigs
    .map((s) => converterParsed(s.signature, porSig.get(s.signature) ?? null, v))
    .filter((m): m is MovimentoOnChain => m !== null);
  return { movimentos, proximoCursor: sigs.length === limite ? sigs[sigs.length - 1].signature : null, fonte: "rpc" };
}

// ---------------------------------------------------------------------------
// Helius Enhanced Transactions (devnet)
// ---------------------------------------------------------------------------

interface HeliusIx {
  programId: string;
  data?: string;
  innerInstructions?: { programId: string; data?: string }[];
}
interface HeliusTx {
  signature: string;
  slot: number;
  timestamp: number;
  transactionError?: unknown;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  accountData?: { account: string; nativeBalanceChange: number }[];
  instructions?: HeliusIx[];
}

function memoHelius(tx: HeliusTx): string | undefined {
  const memoId = MEMO_PROGRAM_ID.toBase58();
  const todas = (tx.instructions ?? []).flatMap((ix) => [ix, ...(ix.innerInstructions ?? [])]);
  for (const ix of todas) {
    if (ix.programId !== memoId || !ix.data) continue;
    try {
      return Buffer.from(decodeBase58(ix.data)).toString("utf8");
    } catch {
      /* ignora */
    }
  }
  return undefined;
}

function converterHelius(tx: HeliusTx, vault: string): MovimentoOnChain | null {
  const conta = tx.accountData?.find((a) => a.account === vault);
  let delta = conta?.nativeBalanceChange ?? 0;
  if (delta === 0) {
    for (const t of tx.nativeTransfers ?? []) {
      if (t.toUserAccount === vault) delta += t.amount;
      if (t.fromUserAccount === vault) delta -= t.amount;
    }
  }
  if (delta === 0) return null;
  const tipo = delta > 0 ? "entrada" : "saida";
  const viaMultisig = (tx.instructions ?? []).some((ix) => ix.programId === SQUADS_PROGRAM_ID.toBase58());
  const memo = memoHelius(tx);
  const { descricao, categoria } = descricaoDe(memo, tipo, viaMultisig);
  const transf = (tx.nativeTransfers ?? []).find((t) => (tipo === "saida" ? t.fromUserAccount === vault : t.toUserAccount === vault));
  return {
    sig: tx.signature,
    slot: tx.slot,
    timestamp: tx.timestamp ?? null,
    tipo,
    lamports: Math.abs(delta),
    contraparte: tipo === "saida" ? transf?.toUserAccount : transf?.fromUserAccount,
    memo,
    descricao,
    categoria,
    viaMultisig,
    falhou: !!tx.transactionError,
  };
}

export async function lerHistoricoHelius(
  apiKey: string,
  vault: PublicKey,
  opts: { limite?: number; antesDe?: string } = {},
): Promise<PaginaHistorico> {
  const limite = Math.min(Math.max(opts.limite ?? 25, 1), 100);
  const url = new URL(`https://api-devnet.helius-rpc.com/v0/addresses/${vault.toBase58()}/transactions`);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("limit", String(limite));
  if (opts.antesDe) url.searchParams.set("before", opts.antesDe);
  const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error(`Helius ${r.status}`);
  const lista = (await r.json()) as HeliusTx[];
  const v = vault.toBase58();
  const movimentos = lista.map((t) => converterHelius(t, v)).filter((m): m is MovimentoOnChain => m !== null);
  return { movimentos, proximoCursor: lista.length === limite ? lista[lista.length - 1].signature : null, fonte: "helius" };
}

/** Escolhe a fonte: Helius se houver chave, senão RPC. Cai no RPC se o Helius falhar. */
export async function lerHistoricoVault(
  connection: Connection,
  vault: PublicKey,
  opts: { limite?: number; antesDe?: string; heliusApiKey?: string } = {},
): Promise<PaginaHistorico> {
  if (opts.heliusApiKey) {
    try {
      return await lerHistoricoHelius(opts.heliusApiKey, vault, opts);
    } catch (e) {
      console.warn("Helius falhou, usando RPC:", e instanceof Error ? e.message : e);
    }
  }
  return lerHistoricoRpc(connection, vault, opts);
}
