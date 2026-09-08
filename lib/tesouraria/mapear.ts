/**
 * Traduz o estado do Squads para o vocabulário das telas.
 * Puro: sem React, testável em node.
 */

import type { PublicKey } from "@solana/web3.js";
import type { Categoria } from "../types";
import type { CofreLocal, SignatarioLocal } from "../cofre-store";
import { lamportsParaSol } from "../solana/config";
import { lerMemoLigaFi, type AcaoConfigLida, type PropostaInfo } from "../solana/squads";
import { iniciaisDe } from "../format";

export type StatusUI = "pendente" | "aprovada" | "executada" | "rejeitada" | "cancelada" | "obsoleta";

export interface PropostaUI {
  id: string;
  indice: bigint;
  tipo: "pagamento" | "gestao" | "outra";
  descricao: string;
  categoria: Categoria;
  /** Só em pagamentos. */
  valorSol?: number;
  destinatario?: string;
  destinatarioNome?: string;
  acoes?: AcaoConfigLida[];
  criador?: string;
  aprovacoes: string[];
  rejeicoes: string[];
  status: StatusUI;
  statusEm?: number;
  necessarias: number;
  proposalPda: string;
}

const CATEGORIAS: Categoria[] = ["anuidade", "simposio", "material", "palestrante", "coffee", "outros"];

function categoriaValida(c: string | undefined): Categoria {
  return CATEGORIAS.includes(c as Categoria) ? (c as Categoria) : "outros";
}

export function statusUI(p: PropostaInfo): StatusUI {
  if (p.obsoleta) return "obsoleta";
  switch (p.status) {
    case "Executed":
      return "executada";
    case "Approved":
      return "aprovada";
    case "Rejected":
      return "rejeitada";
    case "Cancelled":
      return "cancelada";
    default:
      return "pendente";
  }
}

export function descreverAcoes(acoes: AcaoConfigLida[], nomes: (k: string) => string): string {
  const add = acoes.filter((a) => a.tipo === "AddMember").length;
  const rem = acoes.filter((a) => a.tipo === "RemoveMember").length;
  const thr = acoes.find((a) => a.tipo === "ChangeThreshold");
  const partes: string[] = [];
  if (add) partes.push(`+${add} signatário${add > 1 ? "s" : ""}`);
  if (rem) partes.push(`−${rem} signatário${rem > 1 ? "s" : ""}`);
  if (thr) partes.push(`threshold → ${thr.valor}`);
  if (acoes.length === 1 && acoes[0].chave) partes.push(`(${nomes(acoes[0].chave.toBase58())})`);
  return partes.length ? `Troca de gestão: ${partes.join(", ")}` : "Mudança de configuração";
}

export function mapearProposta(p: PropostaInfo, threshold: number, cofre: CofreLocal | null): PropostaUI {
  const meta = cofre?.propostas[p.transactionIndex.toString()];
  const memo = lerMemoLigaFi(p.memo);
  const nomes = (k: string) => nomeDe(k, cofre?.signatarios ?? []);
  const base = {
    id: p.transactionIndex.toString(),
    indice: p.transactionIndex,
    criador: p.criador?.toBase58(),
    aprovacoes: p.aprovacoes.map((k) => k.toBase58()),
    rejeicoes: p.rejeicoes.map((k) => k.toBase58()),
    status: statusUI(p),
    statusEm: p.statusEm,
    necessarias: threshold,
    proposalPda: p.proposalPda.toBase58(),
  };
  if (p.tipo === "vault") {
    return {
      ...base,
      tipo: "pagamento",
      descricao: memo?.descricao ?? meta?.descricao ?? `Transferência #${p.transactionIndex}`,
      categoria: categoriaValida(memo?.categoria ?? meta?.categoria),
      valorSol: p.transferencia ? lamportsParaSol(p.transferencia.lamports) : undefined,
      destinatario: p.transferencia?.destinatario.toBase58(),
      destinatarioNome: meta?.destinatarioNome,
    };
  }
  if (p.tipo === "config") {
    return {
      ...base,
      tipo: "gestao",
      descricao: meta?.descricao ?? descreverAcoes(p.acoes ?? [], nomes),
      categoria: "outros",
      acoes: p.acoes,
    };
  }
  return { ...base, tipo: "outra", descricao: meta?.descricao ?? `Proposta #${p.transactionIndex}`, categoria: "outros" };
}

export function nomeDe(endereco: string, signatarios: SignatarioLocal[]): string {
  return signatarios.find((s) => s.endereco === endereco)?.nome ?? `${endereco.slice(0, 4)}…${endereco.slice(-4)}`;
}

export function cargoDe(endereco: string, signatarios: SignatarioLocal[]): string | undefined {
  return signatarios.find((s) => s.endereco === endereco)?.cargo;
}

export function iniciaisEndereco(endereco: string, signatarios: SignatarioLocal[]): string {
  const s = signatarios.find((x) => x.endereco === endereco);
  return s ? iniciaisDe(s.nome) : endereco.slice(0, 2).toUpperCase();
}

export function ehMembro(endereco: string | null | undefined, membros: { key: PublicKey }[]): boolean {
  return !!endereco && membros.some((m) => m.key.toBase58() === endereco);
}
