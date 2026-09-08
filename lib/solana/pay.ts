/**
 * lib/solana/pay.ts — Solana Pay (transfer request) sem SDK.
 *
 * Spec: https://docs.solanapay.com/spec
 *   solana:<recipient>?amount=<SOL>&reference=<pubkey>&label=…&message=…&memo=…
 *
 * `reference` é uma chave pública aleatória incluída como conta somente
 * leitura na transferência. Como nenhuma outra transação toca essa conta,
 * `getSignaturesForAddress(reference)` encontra o pagamento com certeza.
 * Puro (sem React): roda no servidor (route handler) e em scripts.
 */

import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "./squads";

export interface CobrancaParams {
  /** Endereço que recebe: no LigaFi, o Vault PDA do multisig. */
  destinatario: string;
  /** Valor em SOL (ex.: 0.05). */
  valor: number;
  /** Texto exibido na carteira do pagador. */
  label: string;
  /** Chave pública aleatória que identifica esta cobrança. */
  reference?: string;
  message?: string;
  memo?: string;
  /** Mint de SPL token. Ausente = SOL nativo. */
  splToken?: string;
}

/** Valor SOL como decimal simples, sem notação científica (spec exige). */
export function formatAmount(valor: number): string {
  return valor.toFixed(9).replace(/\.?0+$/, "");
}

export function montarUrlSolanaPay(p: CobrancaParams): string {
  const q = new URLSearchParams();
  q.set("amount", formatAmount(p.valor));
  if (p.splToken) q.set("spl-token", p.splToken);
  if (p.reference) q.set("reference", p.reference);
  q.set("label", p.label);
  if (p.message) q.set("message", p.message);
  if (p.memo) q.set("memo", p.memo);
  // URLSearchParams codifica espaço como "+"; a spec pede %20.
  return `solana:${p.destinatario}?${q.toString().replace(/\+/g, "%20")}`;
}

/** Nova reference: só a chave pública é usada; a privada é descartada. */
export function gerarReference(): string {
  return Keypair.generate().publicKey.toBase58();
}

export interface StatusCobranca {
  status: "pendente" | "confirmado" | "valor_diferente";
  sig?: string;
  lamportsRecebidos?: number;
  timestamp?: number | null;
  pagador?: string;
}

/**
 * Procura a transação que carrega `reference` e valida que o destinatário
 * recebeu pelo menos o esperado.
 */
export async function verificarCobranca(
  connection: Connection,
  p: { reference: string; destinatario: string; lamportsEsperados: number },
): Promise<StatusCobranca> {
  const ref = new PublicKey(p.reference);
  const sigs = await connection.getSignaturesForAddress(ref, { limit: 5 }, "confirmed");
  const ok = sigs.filter((s) => !s.err);
  if (ok.length === 0) return { status: "pendente" };

  for (const s of ok) {
    const tx = await connection.getParsedTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx?.meta) continue;
    const chaves = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    const idx = chaves.indexOf(p.destinatario);
    if (idx < 0) continue;
    const delta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
    if (delta <= 0) continue;
    const pagador = tx.transaction.message.accountKeys.find((k) => k.signer)?.pubkey.toBase58();
    return {
      status: delta >= p.lamportsEsperados ? "confirmado" : "valor_diferente",
      sig: s.signature,
      lamportsRecebidos: delta,
      timestamp: tx.blockTime ?? null,
      pagador,
    };
  }
  return { status: "pendente" };
}

/**
 * Monta a transação que uma carteira faz ao ler o QR: transferência com a
 * `reference` como conta somente leitura + memo opcional. Usado no teste
 * headless e útil para "pagar com a carteira conectada" no app.
 */
export function montarTransacaoPagamento(p: {
  pagador: PublicKey;
  destinatario: PublicKey;
  lamports: number;
  reference: PublicKey;
  memo?: string;
}): Transaction {
  const ix = SystemProgram.transfer({ fromPubkey: p.pagador, toPubkey: p.destinatario, lamports: p.lamports });
  ix.keys.push({ pubkey: p.reference, isSigner: false, isWritable: false });
  const tx = new Transaction().add(ix);
  if (p.memo) {
    tx.add(new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [{ pubkey: p.pagador, isSigner: true, isWritable: false }], data: Buffer.from(p.memo, "utf8") }));
  }
  return tx;
}

export function solParaLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
