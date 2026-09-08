/**
 * lib/solana/squads.ts — integração real com Squads Protocol v4 (devnet).
 *
 * Modelo:
 *   - O multisig É a entidade. Signatários são `members` com Permissions.all().
 *   - Saldo no Vault PDA (índice 0). Ninguém tem a chave do vault.
 *   - Pagamento = VaultTransaction + Proposal → aprovações → execução.
 *   - Troca de gestão = ConfigTransaction (Add/RemoveMember) + Proposal,
 *     também sujeita ao threshold. O cofre não muda de endereço.
 *   - `config_authority` é SEMPRE null: governança 100% on-chain. Validado
 *     logo após a criação e em toda leitura (`governancaOnChain`).
 *
 * Nenhuma chave privada aqui: quem assina é um `Assinador` (wallet adapter
 * no app; Keypair efêmero só em scripts de teste).
 */

import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Commitment,
} from "@solana/web3.js";
import { ErroLigaFi, traduzirErro } from "./erros";

export const PROGRAM_ID = multisig.PROGRAM_ID;
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const PREFIXO_MEMO = "LigaFi:";

const { Permissions } = multisig.types;

/** beet.bignum sem importar o pacote transitivo. */
type Bignum = number | bigint | { toString(): string };

// ---------------------------------------------------------------------------
// Assinador: abstrai wallet adapter (app) e Keypair (scripts de teste)
// ---------------------------------------------------------------------------

export interface Assinador {
  publicKey: PublicKey;
  /** Assina e envia. `extras` são signers adicionais (ex.: createKey). */
  enviar(tx: Transaction | VersionedTransaction, connection: Connection, extras?: Keypair[]): Promise<string>;
}

type SendTransactionLike = (
  tx: Transaction | VersionedTransaction,
  connection: Connection,
  options?: { signers?: Keypair[]; skipPreflight?: boolean; preflightCommitment?: Commitment },
) => Promise<string>;

export function assinadorWallet(w: { publicKey: PublicKey | null; sendTransaction: SendTransactionLike }): Assinador {
  if (!w.publicKey) throw new ErroLigaFi("Conecte a carteira antes de continuar.", "carteira_desconectada");
  const publicKey = w.publicKey;
  return {
    publicKey,
    enviar: (tx, connection, extras) => w.sendTransaction(tx, connection, { signers: extras, preflightCommitment: "confirmed" }),
  };
}

/** Só para scripts/testes. Nunca use com chave real no app. */
export function assinadorKeypair(kp: Keypair): Assinador {
  return {
    publicKey: kp.publicKey,
    enviar: async (tx, connection, extras = []) => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([kp, ...extras]);
        return connection.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
      }
      tx.sign(kp, ...extras);
      return connection.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
    },
  };
}

// ---------------------------------------------------------------------------
// Tipos de leitura
// ---------------------------------------------------------------------------

export interface MembroOnChain {
  key: PublicKey;
  podePropor: boolean;
  podeVotar: boolean;
  podeExecutar: boolean;
}

export interface MultisigInfo {
  multisigPda: PublicKey;
  vaultPda: PublicKey;
  threshold: number;
  timeLock: number;
  membros: MembroOnChain[];
  transactionIndex: bigint;
  staleTransactionIndex: bigint;
  configAuthority: PublicKey;
  /** true ⇔ configAuthority == PublicKey.default. A tese do produto. */
  governancaOnChain: boolean;
  saldoVaultLamports: number;
}

export type StatusProposta = "Draft" | "Active" | "Approved" | "Rejected" | "Executing" | "Executed" | "Cancelled";

export interface TransferenciaLida {
  destinatario: PublicKey;
  lamports: bigint;
}

export interface AcaoConfigLida {
  tipo: "AddMember" | "RemoveMember" | "ChangeThreshold" | "SetTimeLock" | "Outra";
  chave?: PublicKey;
  valor?: number;
}

export interface PropostaInfo {
  transactionIndex: bigint;
  proposalPda: PublicKey;
  transactionPda: PublicKey;
  status: StatusProposta;
  /** Unix seconds do último status, quando disponível. */
  statusEm?: number;
  aprovacoes: PublicKey[];
  rejeicoes: PublicKey[];
  criador?: PublicKey;
  tipo: "vault" | "config" | "desconhecido";
  transferencia?: TransferenciaLida;
  memo?: string;
  acoes?: AcaoConfigLida[];
  /** Índice antigo demais (anterior a uma mudança de config): não executa mais. */
  obsoleta: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function memoIx(texto: string): TransactionInstruction {
  return new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(texto, "utf8") });
}

async function enviarEConfirmar(
  connection: Connection,
  assinador: Assinador,
  instrucoes: TransactionInstruction[],
  extras: Keypair[] = [],
): Promise<string> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: assinador.publicKey, blockhash, lastValidBlockHeight }).add(...instrucoes);
    const sig = await assinador.enviar(tx, connection, extras);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  } catch (e) {
    throw traduzirErro(e);
  }
}

function bn(n: Bignum | number | bigint): bigint {
  return typeof n === "bigint" ? n : BigInt(n.toString());
}

function statusDe(p: multisig.generated.Proposal): { status: StatusProposta; em?: number } {
  const s = p.status as { __kind: StatusProposta; timestamp?: Bignum };
  return { status: s.__kind, em: s.timestamp !== undefined ? Number(bn(s.timestamp)) : undefined };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function lerProgramConfig(connection: Connection): Promise<{ treasury: PublicKey; taxaCriacaoLamports: bigint }> {
  const [pda] = multisig.getProgramConfigPda({});
  const cfg = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, pda);
  return { treasury: cfg.treasury, taxaCriacaoLamports: bn(cfg.multisigCreationFee) };
}

export function derivarVault(multisigPda: PublicKey): PublicKey {
  return multisig.getVaultPda({ multisigPda, index: 0 })[0];
}

export async function lerMultisig(connection: Connection, multisigPda: PublicKey): Promise<MultisigInfo> {
  let conta: multisig.generated.Multisig;
  try {
    const raw = await connection.getAccountInfo(multisigPda, "confirmed");
    if (!raw) throw new ErroLigaFi("Multisig não encontrado na devnet. Confira o endereço ou crie o cofre em /setup.", "nao_encontrado");
    if (!raw.owner.equals(PROGRAM_ID)) {
      throw new ErroLigaFi("Este endereço existe, mas não é um multisig do Squads v4.", "nao_encontrado");
    }
    [conta] = multisig.accounts.Multisig.fromAccountInfo(raw);
  } catch (e) {
    throw traduzirErro(e);
  }
  const vaultPda = derivarVault(multisigPda);
  const saldoVaultLamports = await connection.getBalance(vaultPda, "confirmed");
  return {
    multisigPda,
    vaultPda,
    threshold: conta.threshold,
    timeLock: conta.timeLock,
    membros: conta.members.map((m) => ({
      key: m.key,
      podePropor: Permissions.has(m.permissions, multisig.types.Permission.Initiate),
      podeVotar: Permissions.has(m.permissions, multisig.types.Permission.Vote),
      podeExecutar: Permissions.has(m.permissions, multisig.types.Permission.Execute),
    })),
    transactionIndex: bn(conta.transactionIndex),
    staleTransactionIndex: bn(conta.staleTransactionIndex),
    configAuthority: conta.configAuthority,
    governancaOnChain: conta.configAuthority.equals(PublicKey.default),
    saldoVaultLamports,
  };
}

/** Lança se o multisig tiver config_authority. É a invariante central. */
export function assertGovernancaOnChain(info: MultisigInfo): void {
  if (!info.governancaOnChain) {
    throw new ErroLigaFi(
      `Este multisig tem config_authority (${info.configAuthority.toBase58()}): alguém pode trocar signatários por fora. LigaFi só aceita cofres com governança 100% on-chain.`,
      "governanca",
    );
  }
}

/** Extrai transferência SOL e memo de uma VaultTransaction. */
function lerMensagemVault(msg: multisig.generated.VaultTransactionMessage): { transferencia?: TransferenciaLida; memo?: string } {
  let transferencia: TransferenciaLida | undefined;
  let memo: string | undefined;
  for (const ix of msg.instructions) {
    const programa = msg.accountKeys[ix.programIdIndex];
    const data = Buffer.from(ix.data);
    if (programa.equals(SystemProgram.programId) && data.length >= 12 && data.readUInt32LE(0) === 2) {
      transferencia = { destinatario: msg.accountKeys[ix.accountIndexes[1]], lamports: data.readBigUInt64LE(4) };
    } else if (programa.equals(MEMO_PROGRAM_ID)) {
      memo = data.toString("utf8");
    }
  }
  return { transferencia, memo };
}

function lerAcoes(acoes: multisig.types.ConfigAction[]): AcaoConfigLida[] {
  return acoes.map((a) => {
    if (multisig.types.isConfigActionAddMember(a)) return { tipo: "AddMember", chave: a.newMember.key };
    if (multisig.types.isConfigActionRemoveMember(a)) return { tipo: "RemoveMember", chave: a.oldMember };
    if (multisig.types.isConfigActionChangeThreshold(a)) return { tipo: "ChangeThreshold", valor: a.newThreshold };
    if (multisig.types.isConfigActionSetTimeLock(a)) return { tipo: "SetTimeLock", valor: a.newTimeLock };
    return { tipo: "Outra" };
  });
}

export async function lerProposta(connection: Connection, multisigPda: PublicKey, transactionIndex: bigint): Promise<PropostaInfo> {
  const [lista] = await listarPropostas(connection, multisigPda, { indices: [transactionIndex] });
  if (!lista) throw new ErroLigaFi("Proposta não encontrada neste cofre.", "desconhecido");
  return lista;
}

/**
 * Lista propostas (mais recente primeiro). Busca Proposal + Transaction em
 * lote com getMultipleAccountsInfo. Por padrão as últimas `limite`.
 */
export async function listarPropostas(
  connection: Connection,
  multisigPda: PublicKey,
  opts: { limite?: number; indices?: bigint[] } = {},
): Promise<PropostaInfo[]> {
  const info = opts.indices ? undefined : await lerMultisig(connection, multisigPda);
  const stale = info?.staleTransactionIndex ?? 0n;
  let indices = opts.indices;
  if (!indices) {
    const ultimo = info!.transactionIndex;
    const limite = BigInt(opts.limite ?? 40);
    const primeiro = ultimo > limite ? ultimo - limite + 1n : 1n;
    indices = [];
    for (let i = ultimo; i >= primeiro; i--) indices.push(i);
  }
  if (indices.length === 0) return [];

  const pdas = indices.flatMap((i) => [
    multisig.getProposalPda({ multisigPda, transactionIndex: i })[0],
    multisig.getTransactionPda({ multisigPda, index: i })[0],
  ]);
  const contas = await connection.getMultipleAccountsInfo(pdas, "confirmed");

  const out: PropostaInfo[] = [];
  indices.forEach((transactionIndex, k) => {
    const propInfo = contas[k * 2];
    const txInfo = contas[k * 2 + 1];
    if (!propInfo) return;
    const [proposal] = multisig.accounts.Proposal.fromAccountInfo(propInfo);
    const { status, em } = statusDe(proposal);
    const base: PropostaInfo = {
      transactionIndex,
      proposalPda: pdas[k * 2],
      transactionPda: pdas[k * 2 + 1],
      status,
      statusEm: em,
      aprovacoes: proposal.approved,
      rejeicoes: proposal.rejected,
      tipo: "desconhecido",
      obsoleta: transactionIndex <= stale && status !== "Executed",
    };
    if (txInfo) {
      const disc = Array.from(txInfo.data.subarray(0, 8));
      const igual = (d: number[]) => d.every((b, i) => b === disc[i]);
      if (igual(multisig.accounts.vaultTransactionDiscriminator)) {
        const [vt] = multisig.accounts.VaultTransaction.fromAccountInfo(txInfo);
        Object.assign(base, { tipo: "vault", criador: vt.creator, ...lerMensagemVault(vt.message) });
      } else if (igual(multisig.accounts.configTransactionDiscriminator)) {
        const [ct] = multisig.accounts.ConfigTransaction.fromAccountInfo(txInfo);
        Object.assign(base, { tipo: "config", criador: ct.creator, acoes: lerAcoes(ct.actions) });
      }
    }
    out.push(base);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export interface CriarMultisigParams {
  connection: Connection;
  assinador: Assinador;
  membros: PublicKey[];
  threshold: number;
  timeLock?: number;
  memo?: string;
}

export interface MultisigCriado extends MultisigInfo {
  createKey: PublicKey;
  assinatura: string;
  taxaCriacaoLamports: bigint;
}

/**
 * Cria o multisig com config_authority = null e valida lendo de volta.
 */
export async function criarMultisig(p: CriarMultisigParams): Promise<MultisigCriado> {
  const unicos = Array.from(new Set(p.membros.map((m) => m.toBase58()))).map((s) => new PublicKey(s));
  if (unicos.length < 1) throw new ErroLigaFi("Informe ao menos um signatário.", "desconhecido");
  if (p.threshold < 1 || p.threshold > unicos.length) {
    throw new ErroLigaFi(`Threshold precisa estar entre 1 e ${unicos.length}.`, "desconhecido");
  }

  const { treasury, taxaCriacaoLamports } = await lerProgramConfig(p.connection);
  const createKey = Keypair.generate(); // efêmera: só assina a criação e é descartada
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });

  const ix = multisig.instructions.multisigCreateV2({
    treasury,
    creator: p.assinador.publicKey,
    multisigPda,
    configAuthority: null, // governança 100% on-chain
    threshold: p.threshold,
    members: unicos.map((key) => ({ key, permissions: Permissions.all() })),
    timeLock: p.timeLock ?? 0,
    createKey: createKey.publicKey,
    rentCollector: null,
    memo: p.memo,
  });

  const assinatura = await enviarEConfirmar(p.connection, p.assinador, [ix], [createKey]);
  const info = await lerMultisig(p.connection, multisigPda);
  assertGovernancaOnChain(info);
  return { ...info, createKey: createKey.publicKey, assinatura, taxaCriacaoLamports };
}

export async function depositarNoVault(p: {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  lamports: number | bigint;
}): Promise<string> {
  const ix = SystemProgram.transfer({
    fromPubkey: p.assinador.publicKey,
    toPubkey: derivarVault(p.multisigPda),
    lamports: BigInt(p.lamports),
  });
  return enviarEConfirmar(p.connection, p.assinador, [ix]);
}

export interface ProporTransferenciaParams {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  destinatario: PublicKey;
  lamports: number | bigint;
  /** Vai no memo on-chain como "LigaFi:<descricao>|<categoria>". */
  descricao: string;
  categoria?: string;
  /** Proponente já aprova na mesma transação (padrão true). */
  aprovarAoPropor?: boolean;
}

export interface PropostaCriada {
  transactionIndex: bigint;
  proposalPda: PublicKey;
  assinatura: string;
}

export function montarMemo(descricao: string, categoria = "outros"): string {
  return `${PREFIXO_MEMO}${descricao.replace(/\|/g, "/").slice(0, 120)}|${categoria}`;
}

export function lerMemoLigaFi(memo?: string): { descricao: string; categoria: string } | null {
  if (!memo || !memo.startsWith(PREFIXO_MEMO)) return null;
  const [descricao, categoria = "outros"] = memo.slice(PREFIXO_MEMO.length).split("|");
  return { descricao, categoria };
}

export async function proporTransferencia(p: ProporTransferenciaParams): Promise<PropostaCriada> {
  const info = await lerMultisig(p.connection, p.multisigPda);
  assertGovernancaOnChain(info);
  const transactionIndex = info.transactionIndex + 1n;

  const mensagem = new TransactionMessage({
    payerKey: info.vaultPda,
    recentBlockhash: PublicKey.default.toBase58(), // ignorado: o Squads compila só as instruções
    instructions: [
      SystemProgram.transfer({ fromPubkey: info.vaultPda, toPubkey: p.destinatario, lamports: BigInt(p.lamports) }),
      memoIx(montarMemo(p.descricao, p.categoria)),
    ],
  });

  const ixs = [
    multisig.instructions.vaultTransactionCreate({
      multisigPda: p.multisigPda,
      transactionIndex,
      creator: p.assinador.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: mensagem,
      memo: p.descricao.slice(0, 60),
    }),
    multisig.instructions.proposalCreate({ multisigPda: p.multisigPda, transactionIndex, creator: p.assinador.publicKey }),
  ];
  if (p.aprovarAoPropor ?? true) {
    ixs.push(multisig.instructions.proposalApprove({ multisigPda: p.multisigPda, transactionIndex, member: p.assinador.publicKey }));
  }
  const assinatura = await enviarEConfirmar(p.connection, p.assinador, ixs);
  return { transactionIndex, proposalPda: multisig.getProposalPda({ multisigPda: p.multisigPda, transactionIndex })[0], assinatura };
}

export async function aprovarProposta(p: {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  transactionIndex: bigint;
}): Promise<string> {
  const ix = multisig.instructions.proposalApprove({
    multisigPda: p.multisigPda,
    transactionIndex: p.transactionIndex,
    member: p.assinador.publicKey,
  });
  return enviarEConfirmar(p.connection, p.assinador, [ix]);
}

export async function rejeitarProposta(p: {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  transactionIndex: bigint;
}): Promise<string> {
  const ix = multisig.instructions.proposalReject({
    multisigPda: p.multisigPda,
    transactionIndex: p.transactionIndex,
    member: p.assinador.publicKey,
  });
  return enviarEConfirmar(p.connection, p.assinador, [ix]);
}

/** Executa uma VaultTransaction aprovada (threshold atingido). */
export async function executarTransferencia(p: {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  transactionIndex: bigint;
}): Promise<string> {
  try {
    const { instruction, lookupTableAccounts } = await multisig.instructions.vaultTransactionExecute({
      connection: p.connection,
      multisigPda: p.multisigPda,
      transactionIndex: p.transactionIndex,
      member: p.assinador.publicKey,
    });
    const { blockhash, lastValidBlockHeight } = await p.connection.getLatestBlockhash("confirmed");
    const msg = new TransactionMessage({
      payerKey: p.assinador.publicKey,
      recentBlockhash: blockhash,
      instructions: [instruction],
    }).compileToV0Message(lookupTableAccounts);
    const tx = new VersionedTransaction(msg);
    const sig = await p.assinador.enviar(tx, p.connection);
    await p.connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  } catch (e) {
    throw traduzirErro(e);
  }
}

export interface ProporTrocaParams {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  adicionar: PublicKey[];
  remover: PublicKey[];
  novoThreshold?: number;
  memo?: string;
  aprovarAoPropor?: boolean;
}

/**
 * Troca de gestão: uma ConfigTransaction com AddMember (primeiro) e
 * RemoveMember, opcionalmente ChangeThreshold. Sujeita ao threshold atual.
 */
export async function proporTrocaDeSignatarios(p: ProporTrocaParams): Promise<PropostaCriada> {
  const info = await lerMultisig(p.connection, p.multisigPda);
  assertGovernancaOnChain(info);
  const transactionIndex = info.transactionIndex + 1n;

  const atuais = new Set(info.membros.map((m) => m.key.toBase58()));
  const acoes: multisig.types.ConfigAction[] = [];
  for (const k of p.adicionar) {
    if (!atuais.has(k.toBase58())) acoes.push({ __kind: "AddMember", newMember: { key: k, permissions: Permissions.all() } });
  }
  for (const k of p.remover) {
    if (atuais.has(k.toBase58())) acoes.push({ __kind: "RemoveMember", oldMember: k });
  }
  if (p.novoThreshold !== undefined && p.novoThreshold !== info.threshold) {
    acoes.push({ __kind: "ChangeThreshold", newThreshold: p.novoThreshold });
  }
  if (acoes.length === 0) throw new ErroLigaFi("Nada a mudar: os signatários informados já são os atuais.", "desconhecido");

  const totalFinal = atuais.size + p.adicionar.filter((k) => !atuais.has(k.toBase58())).length - p.remover.filter((k) => atuais.has(k.toBase58())).length;
  const thresholdFinal = p.novoThreshold ?? info.threshold;
  if (thresholdFinal > totalFinal) {
    throw new ErroLigaFi(`Threshold ${thresholdFinal} maior que o número final de signatários (${totalFinal}).`, "desconhecido");
  }

  const ixs = [
    multisig.instructions.configTransactionCreate({
      multisigPda: p.multisigPda,
      transactionIndex,
      creator: p.assinador.publicKey,
      actions: acoes,
      memo: p.memo,
    }),
    multisig.instructions.proposalCreate({ multisigPda: p.multisigPda, transactionIndex, creator: p.assinador.publicKey }),
  ];
  if (p.aprovarAoPropor ?? true) {
    ixs.push(multisig.instructions.proposalApprove({ multisigPda: p.multisigPda, transactionIndex, member: p.assinador.publicKey }));
  }
  const assinatura = await enviarEConfirmar(p.connection, p.assinador, ixs);
  return { transactionIndex, proposalPda: multisig.getProposalPda({ multisigPda: p.multisigPda, transactionIndex })[0], assinatura };
}

export async function executarTrocaDeSignatarios(p: {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  transactionIndex: bigint;
}): Promise<string> {
  const ix = multisig.instructions.configTransactionExecute({
    multisigPda: p.multisigPda,
    transactionIndex: p.transactionIndex,
    member: p.assinador.publicKey,
    rentPayer: p.assinador.publicKey,
  });
  return enviarEConfirmar(p.connection, p.assinador, [ix]);
}

/** Executa qualquer proposta aprovada, decidindo pelo tipo. */
export async function executarProposta(p: {
  connection: Connection;
  assinador: Assinador;
  multisigPda: PublicKey;
  transactionIndex: bigint;
}): Promise<string> {
  const prop = await lerProposta(p.connection, p.multisigPda, p.transactionIndex);
  if (prop.status !== "Approved") {
    throw new ErroLigaFi("A proposta ainda não atingiu o quórum.", "quorum_nao_atingido");
  }
  return prop.tipo === "config" ? executarTrocaDeSignatarios(p) : executarTransferencia(p);
}

// ---------------------------------------------------------------------------
// Devnet: airdrop com tratamento de rate limit
// ---------------------------------------------------------------------------

export async function airdropDevnet(connection: Connection, destino: PublicKey, sol = 1): Promise<string> {
  try {
    const sig = await connection.requestAirdrop(destino, Math.round(sol * LAMPORTS_PER_SOL));
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  } catch (e) {
    const t = traduzirErro(e);
    if (t.codigo === "desconhecido") {
      throw new ErroLigaFi("O faucet de devnet recusou o airdrop. Tente um valor menor (0,5 SOL) ou use https://faucet.solana.com.", "airdrop_limite", e);
    }
    throw t;
  }
}
