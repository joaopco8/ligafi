/**
 * lib/solana/squads.ts
 *
 * Integração real do cofre da entidade com Squads Protocol v4.
 * Todas as funções abaixo são STUBS: descrevem a assinatura e o fluxo
 * que a implementação terá, mas não tocam a rede. Nenhum SDK de Solana
 * está instalado neste MVP.
 *
 * Quando for implementar:
 *   npm i @solana/web3.js @sqds/multisig
 *
 * Modelo:
 *   - O multisig É a entidade. Os 5 diretores são `members` com permissão
 *     de propor + votar. `threshold` = 3.
 *   - O saldo fica no Vault PDA (índice 0) do multisig, não em carteira
 *     pessoal de ninguém.
 *   - Cada pagamento vira uma VaultTransaction + Proposal. Diretores
 *     aprovam; ao atingir o threshold qualquer um executa.
 *   - Troca de gestão = `addMember` / `removeMember` via proposta de
 *     configuração, também com 3 de 5. O cofre nunca muda de dono.
 */

// Tipos mínimos para não depender do SDK agora. Substituir por
// `PublicKey`, `Keypair`, `TransactionSignature` de @solana/web3.js.
export type Address = string;
export type Signature = string;
export type Signer = { publicKey: Address; secretKey?: Uint8Array };

export interface CriarMultisigParams {
  /** Quem paga o rent da criação (normalmente a tesoureira, uma única vez). */
  pagador: Signer;
  /** Chaves públicas dos 5 diretores. */
  membros: Address[];
  /** Assinaturas necessárias. LigaFi usa 3. */
  threshold: number;
  /** Segundos de espera entre aprovação e execução. 0 no MVP. */
  timeLock?: number;
  /** Opcional. Se definido, essa chave pode alterar membros sem proposta. Deixe `undefined` para governança 100% on-chain. */
  configAuthority?: Address;
}

export interface MultisigInfo {
  multisigPda: Address;
  vaultPda: Address;
  threshold: number;
  membros: Address[];
  transactionIndex: bigint;
}

export interface ProporPagamentoParams {
  multisigPda: Address;
  /** Diretor que cria a proposta (precisa de permissão Initiate). */
  proponente: Signer;
  destinatario: Address;
  /** Em lamports (SOL) ou na menor unidade do token. */
  valor: bigint;
  /** Mint do SPL token (ex.: BRZ/USDC). `undefined` = SOL nativo. */
  mint?: Address;
  memo?: string;
}

export interface ProposalInfo {
  transactionIndex: bigint;
  proposalPda: Address;
  aprovacoes: Address[];
  rejeicoes: Address[];
  status: "Draft" | "Active" | "Approved" | "Rejected" | "Executed" | "Cancelled";
}

const NAO_IMPLEMENTADO = "lib/solana/squads.ts: stub — integração Squads v4 ainda não implementada.";

/**
 * Cria o multisig da entidade e devolve os PDAs.
 *
 * Fluxo real (Squads v4):
 *   1. `createKey = Keypair.generate()`
 *   2. `[multisigPda] = multisig.getMultisigPda({ createKey })`
 *   3. `[vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 })`
 *   4. `multisig.instructions.multisigCreateV2({ createKey, creator, multisigPda, configAuthority: null, timeLock, members: [...], threshold, treasury, rentCollector })`
 *   5. Envia tx assinada por `pagador` + `createKey`.
 */
export async function criarMultisig(_params: CriarMultisigParams): Promise<MultisigInfo> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Lê o estado atual do multisig (threshold, membros, índice da última transação).
 *
 * Fluxo real: `multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda)`.
 */
export async function lerMultisig(_multisigPda: Address): Promise<MultisigInfo> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Propõe um pagamento saindo do Vault. Devolve o índice da transação,
 * que é o `id` que o painel usa para acompanhar as assinaturas.
 *
 * Fluxo real:
 *   1. `transactionIndex = multisigInfo.transactionIndex + 1n`
 *   2. Monta `TransactionMessage` com `SystemProgram.transfer` (SOL) ou
 *      `createTransferCheckedInstruction` (SPL) do `vaultPda` para o destinatário.
 *   3. `multisig.instructions.vaultTransactionCreate({ multisigPda, transactionIndex, creator, vaultIndex: 0, ephemeralSigners: 0, transactionMessage, memo })`
 *   4. `multisig.instructions.proposalCreate({ multisigPda, transactionIndex, creator })`
 *   5. Envia ambas na mesma tx assinada pelo proponente.
 */
export async function proporPagamento(_params: ProporPagamentoParams): Promise<ProposalInfo> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Registra a aprovação de um diretor. É esta chamada que o botão
 * "Assinar" de /pagamento/[id] fará na versão real.
 *
 * Fluxo real: `multisig.instructions.proposalApprove({ multisigPda, transactionIndex, member })`.
 */
export async function aprovarPagamento(
  _multisigPda: Address,
  _transactionIndex: bigint,
  _diretor: Signer,
): Promise<ProposalInfo> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Rejeita a proposta. Com 3 rejeições de 5 ela é cancelada.
 *
 * Fluxo real: `multisig.instructions.proposalReject(...)`.
 */
export async function rejeitarPagamento(
  _multisigPda: Address,
  _transactionIndex: bigint,
  _diretor: Signer,
): Promise<ProposalInfo> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Executa a transação quando `status === "Approved"`. Qualquer membro
 * pode chamar; na prática o app chama automaticamente após a 3ª assinatura.
 *
 * Fluxo real: `multisig.instructions.vaultTransactionExecute({ connection, multisigPda, transactionIndex, member })`.
 */
export async function executarPagamento(
  _multisigPda: Address,
  _transactionIndex: bigint,
  _executor: Signer,
): Promise<Signature> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Lista propostas pendentes e executadas. Alimenta a lista do /painel.
 *
 * Fluxo real: itera `1n..transactionIndex`, deriva `getProposalPda` e lê
 * `Proposal.fromAccountAddress`. Para volume maior, usar Helius DAS/webhooks.
 */
export async function listarPropostas(_multisigPda: Address): Promise<ProposalInfo[]> {
  throw new Error(NAO_IMPLEMENTADO);
}

/**
 * Troca de gestão: adiciona/remove diretores via proposta de configuração.
 * Também exige 3 de 5. O cofre continua o mesmo — é isso que garante
 * que "a próxima gestão herda".
 *
 * Fluxo real: `configTransactionCreate` com actions `AddMember` / `RemoveMember`,
 * seguido de `proposalCreate`, aprovações e `configTransactionExecute`.
 */
export async function proporTrocaDeGestao(
  _multisigPda: Address,
  _proponente: Signer,
  _adicionar: Address[],
  _remover: Address[],
): Promise<ProposalInfo> {
  throw new Error(NAO_IMPLEMENTADO);
}
