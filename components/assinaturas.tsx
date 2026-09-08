"use client";

import { useCofre } from "@/lib/cofre-store";
import { useDiretor } from "@/lib/store";
import { cargoDe, iniciaisEndereco, nomeDe } from "@/lib/tesouraria/mapear";
import type { DiretorId } from "@/lib/types";

const tamanhos = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;

type Tamanho = keyof typeof tamanhos;

export function Avatar({
  diretor,
  tamanho = "md",
  className = "",
  tom = "palha",
}: {
  diretor: DiretorId;
  tamanho?: Tamanho;
  className?: string;
  tom?: "palha" | "neutro";
}) {
  const d = useDiretor(diretor);
  const cor = tom === "palha" ? "bg-palha text-mata" : "bg-white/15 text-white";
  return (
    <span
      title={d ? `${d.nome} · ${d.cargo}` : diretor}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-mata-card ${cor} ${tamanhos[tamanho]} ${className}`}
    >
      {d?.iniciais ?? "?"}
    </span>
  );
}

export function AvatarVazio({ tamanho = "md", className = "" }: { tamanho?: Tamanho; className?: string }) {
  return (
    <span
      aria-label="assinatura pendente"
      className={`grid shrink-0 place-items-center rounded-full border-2 border-dashed border-white/30 ring-2 ring-mata-card ${tamanhos[tamanho]} ${className}`}
    />
  );
}

/** Iniciais de quem assinou, sobrepostas. Usado no extrato. */
export function Iniciais({ diretores, tamanho = "sm" }: { diretores: DiretorId[]; tamanho?: Tamanho }) {
  if (diretores.length === 0) return null;
  return (
    <span className="flex -space-x-1.5">
      {diretores.map((id) => (
        <Avatar key={id} diretor={id} tamanho={tamanho} />
      ))}
    </span>
  );
}

/**
 * Slots do quórum: preenchidos com quem assinou, vazios para o que falta.
 * Usado no painel, na tela de pagamento e na transição de gestão.
 */
export function SlotsQuorum({
  assinaturas,
  necessarias,
  tamanho = "md",
}: {
  assinaturas: DiretorId[];
  necessarias: number;
  tamanho?: Tamanho;
}) {
  const vazios = Math.max(0, necessarias - assinaturas.length);
  return (
    <span className="flex -space-x-2">
      {assinaturas.map((id) => (
        <Avatar key={id} diretor={id} tamanho={tamanho} />
      ))}
      {Array.from({ length: vazios }).map((_, i) => (
        <AvatarVazio key={`vazio-${i}`} tamanho={tamanho} />
      ))}
    </span>
  );
}

/** Linha "avatar + nome + cargo". */
export function LinhaDiretor({
  diretor,
  direita,
  tom = "palha",
}: {
  diretor: DiretorId;
  direita?: React.ReactNode;
  tom?: "palha" | "neutro";
}) {
  const d = useDiretor(diretor);
  return (
    <li className="flex items-center gap-3 text-sm">
      <Avatar diretor={diretor} tamanho="sm" tom={tom} />
      <span className="min-w-0 flex-1 truncate">
        {d?.nome ?? diretor} <span className="text-white/40">· {d?.cargo}</span>
      </span>
      {direita}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Variantes por endereço (modo on-chain): nome vem do cofre local
// ---------------------------------------------------------------------------

export function AvatarEndereco({
  endereco,
  tamanho = "md",
  tom = "palha",
  className = "",
}: {
  endereco: string;
  tamanho?: Tamanho;
  tom?: "palha" | "neutro";
  className?: string;
}) {
  const signatarios = useCofre((s) => s.cofre?.signatarios ?? []);
  const cor = tom === "palha" ? "bg-palha text-mata" : "bg-white/15 text-white";
  return (
    <span
      title={`${nomeDe(endereco, signatarios)} · ${endereco}`}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-mata-card ${cor} ${tamanhos[tamanho]} ${className}`}
    >
      {iniciaisEndereco(endereco, signatarios)}
    </span>
  );
}

export function SlotsQuorumEnderecos({
  assinaturas,
  necessarias,
  tamanho = "md",
}: {
  assinaturas: string[];
  necessarias: number;
  tamanho?: Tamanho;
}) {
  const vazios = Math.max(0, necessarias - assinaturas.length);
  return (
    <span className="flex -space-x-2">
      {assinaturas.map((e) => (
        <AvatarEndereco key={e} endereco={e} tamanho={tamanho} />
      ))}
      {Array.from({ length: vazios }).map((_, i) => (
        <AvatarVazio key={`vazio-${i}`} tamanho={tamanho} />
      ))}
    </span>
  );
}

export function LinhaSignatario({
  endereco,
  direita,
  tom = "palha",
  destaque,
}: {
  endereco: string;
  direita?: React.ReactNode;
  tom?: "palha" | "neutro";
  destaque?: string;
}) {
  const signatarios = useCofre((s) => s.cofre?.signatarios ?? []);
  const cargo = cargoDe(endereco, signatarios);
  return (
    <li className="flex items-center gap-3 text-sm">
      <AvatarEndereco endereco={endereco} tamanho="sm" tom={tom} />
      <span className="min-w-0 flex-1 truncate">
        {nomeDe(endereco, signatarios)}
        {cargo && <span className="text-white/40"> · {cargo}</span>}
        {destaque && <span className="ml-1 text-[10px] font-semibold uppercase text-palha">{destaque}</span>}
      </span>
      {direita}
    </li>
  );
}
