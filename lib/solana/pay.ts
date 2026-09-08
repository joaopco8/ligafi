/**
 * lib/solana/pay.ts
 *
 * Cobranças via Solana Pay e leitura de histórico via Helius.
 * A única função implementada é `montarUrlSolanaPay`, que é pura e já é
 * usada pela tela /cobranca. O resto são STUBS comentados.
 *
 * Quando for implementar:
 *   npm i @solana/web3.js @solana/pay bignumber.js
 *
 * Referência: https://docs.solanapay.com/spec
 */

import type { Address, Signature } from "./squads";

export interface CobrancaParams {
  /** Endereço que recebe — no LigaFi é sempre o Vault PDA do multisig. */
  destinatario: Address;
  /** Valor em unidades do token (ex.: 120.5). */
  valor: number;
  /** Texto exibido na carteira do pagador. */
  label: string;
  /** Mint do SPL token (BRZ/USDC). `undefined` = SOL nativo. */
  splToken?: Address;
  /** Chave pública aleatória incluída na tx para localizá-la depois. */
  reference?: Address;
  message?: string;
  memo?: string;
}

/**
 * Monta a URL `solana:<endereco>?amount=<valor>&label=<descricao>`.
 * Pura, síncrona, sem SDK. É o que o QR code da tela /cobranca codifica.
 */
export function montarUrlSolanaPay(p: CobrancaParams): string {
  const q = new URLSearchParams();
  q.set("amount", String(p.valor));
  q.set("label", p.label);
  if (p.splToken) q.set("spl-token", p.splToken);
  if (p.reference) q.set("reference", p.reference);
  if (p.message) q.set("message", p.message);
  if (p.memo) q.set("memo", p.memo);
  return `solana:${p.destinatario}?${q.toString()}`;
}

export interface CobrancaCriada {
  url: string;
  reference: Address;
  criadaEm: string;
}

const NAO_IMPLEMENTADO = "lib/solana/pay.ts: stub — integração Solana Pay/Helius ainda não implementada.";

/**
 * Cria uma cobrança rastreável: gera `reference = Keypair.generate().publicKey`
 * e devolve a URL com ela embutida.
 *
 * Fluxo real: `encodeURL({ recipient, amount: new BigNumber(valor), splToken, reference, label, message, memo })` de @solana/pay.
 */
export async function criarCobranca(_p: Omit<CobrancaParams, "reference">): Promise<CobrancaCriada> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Aguarda o pagamento aparecer on-chain.
 *
 * Fluxo real: poll `findReference(connection, reference)` e depois
 * `validateTransfer(connection, signature, { recipient, amount, splToken, reference })`.
 * Alternativa: webhook Helius filtrando por `reference` (ver `registrarWebhookHelius`).
 */
export async function aguardarPagamento(
  _reference: Address,
  _opts?: { timeoutMs?: number },
): Promise<Signature> {
  throw new Error(NAO_IMPLEMENTADO);
}

export interface TransacaoHistorico {
  signature: Signature;
  /** Unix timestamp em segundos. */
  timestamp: number;
  tipo: "entrada" | "saida";
  valor: number;
  contraparte: Address;
  memo?: string;
  /** Preenchido em saídas: membros que aprovaram no Squads. */
  aprovadores?: Address[];
}

/**
 * Lê o histórico do Vault para montar o extrato público.
 *
 * Fluxo real (Helius Enhanced Transactions API):
 *   GET https://api.helius.xyz/v0/addresses/{vaultPda}/transactions?api-key=...&type=TRANSFER
 *   Mapear `nativeTransfers` / `tokenTransfers` para entrada/saida conforme
 *   `toUserAccount === vaultPda`. Para saídas, cruzar com a Proposal do
 *   Squads (via `transactionIndex` no memo) para obter os aprovadores.
 */
export async function lerHistoricoHelius(
  _vaultPda: Address,
  _opts?: { limite?: number; antesDe?: Signature },
): Promise<TransacaoHistorico[]> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Registra um webhook Helius para o Vault. Substitui o polling:
 * cada transferência chega em tempo real e o extrato atualiza sozinho.
 *
 * Fluxo real:
 *   POST https://api.helius.xyz/v0/webhooks?api-key=...
 *   { webhookURL, transactionTypes: ["TRANSFER"], accountAddresses: [vaultPda], webhookType: "enhanced" }
 */
export async function registrarWebhookHelius(
  _vaultPda: Address,
  _webhookUrl: string,
): Promise<{ webhookId: string }> {
  throw new Error(NAO_IMPLEMENTADO);
}
