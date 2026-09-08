"use client";

/**
 * Identidade = carteira conectada. Sem senha, sem login.
 *
 * Dado o endereço conectado, resolve o papel:
 *   - signatario: está entre os 5 diretores da gestão atual
 *   - membro:     está na lista de membros da liga
 *   - visitante:  qualquer outro endereço (ou ninguém conectado)
 *
 * Em modo demo (NEXT_PUBLIC_DEMO_MODE=true) uma sessão "demo" ou qualquer
 * carteira conectada vira signatário, assinando como `diretorAtual`.
 * Fora do demo, a fonte da lista de signatários passa a ser a chain
 * (members[] do multisig) a partir da Fase 4.
 */

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { useCofre } from "./cofre-store";
import { membros as membrosMock } from "./mock-data";
import { DEMO_MODE } from "./solana/config";
import { useDiretoresAtuais, useLigaFi } from "./store";
import { useChainStore } from "./tesouraria/chain-store";
import type { Diretor, Membro } from "./types";

export type PapelAcesso = "signatario" | "membro" | "visitante";

export interface Identidade {
  papel: PapelAcesso;
  /** Modo chain: há multisig configurado (env ou /setup)? */
  temCofre: boolean;
  /** Endereço conectado (ou null). */
  endereco: string | null;
  conectada: boolean;
  /** true enquanto autoConnect/hidratação ainda podem mudar a resposta. */
  carregando: boolean;
  /** Sessão sem carteira em modo demo. */
  sessaoDemo: boolean;
  /** Diretor correspondente (real ou o `diretorAtual` do demo). */
  diretor?: Diretor;
  membro?: Membro;
}

export interface ContextoPapel {
  diretoresAtuais: Diretor[];
  membros: Membro[];
  diretorAtual?: Diretor;
  demo: boolean;
  sessaoDemo: boolean;
}

/** Pura, testável: resolve o papel sem tocar em React. */
export function resolverPapel(endereco: string | null, ctx: ContextoPapel): Pick<Identidade, "papel" | "diretor" | "membro"> {
  if (endereco) {
    const diretor = ctx.diretoresAtuais.find((d) => d.endereco === endereco);
    if (diretor) return { papel: "signatario", diretor };
    const membro = ctx.membros.find((m) => m.endereco === endereco);
    if (membro && !ctx.demo) return { papel: "membro", membro };
    if (ctx.demo) return { papel: "signatario", diretor: ctx.diretorAtual, membro };
    return { papel: "visitante" };
  }
  if (ctx.demo && ctx.sessaoDemo) return { papel: "signatario", diretor: ctx.diretorAtual };
  return { papel: "visitante" };
}

/** Janela em que o autoConnect ainda pode reconectar após o reload. */
const JANELA_AUTOCONNECT_MS = 1200;

export function useIdentidade(): Identidade {
  const { publicKey, connected, connecting, wallet } = useWallet();
  const hidratado = useLigaFi((s) => s.hidratado);
  const carteira = useLigaFi((s) => s.carteira);
  const diretorAtualId = useLigaFi((s) => s.diretorAtual);
  const setDiretorAtual = useLigaFi((s) => s.setDiretorAtual);
  const diretoresAtuais = useDiretoresAtuais();

  // Modo chain: signatário = membro do multisig lido da devnet.
  const chainInfo = useChainStore((s) => s.info);
  const chainCarregando = useChainStore((s) => s.carregando);
  const cofre = useCofre((s) => s.cofre);
  const cofreHidratado = useCofre((s) => s.hidratado);

  const [montadoHa, setMontadoHa] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMontadoHa(true), JANELA_AUTOCONNECT_MS);
    return () => clearTimeout(t);
  }, []);

  const endereco = publicKey?.toBase58() ?? null;
  const sessaoDemo = DEMO_MODE && carteira?.rede === "demo";
  const diretorAtual = diretoresAtuais.find((d) => d.id === diretorAtualId) ?? diretoresAtuais[0];

  const resolvido = useMemo<Pick<Identidade, "papel" | "diretor" | "membro">>(() => {
    if (DEMO_MODE) {
      return resolverPapel(endereco, { diretoresAtuais, membros: membrosMock, diretorAtual, demo: true, sessaoDemo });
    }
    const membrosChain = chainInfo?.membros.map((m) => m.key.toBase58()) ?? [];
    if (endereco && membrosChain.includes(endereco)) return { papel: "signatario" };
    return { papel: "visitante" };
  }, [endereco, diretoresAtuais, diretorAtual, sessaoDemo, chainInfo]);

  // Carteira real que é diretora assina como ela mesma.
  useEffect(() => {
    if (resolvido.diretor && resolvido.diretor.id !== diretorAtualId && endereco && resolvido.diretor.endereco === endereco) {
      setDiretorAtual(resolvido.diretor.id);
    }
  }, [resolvido.diretor, diretorAtualId, endereco, setDiretorAtual]);

  // Carregando: store não hidratou, adapter conectando, ou há carteira
  // lembrada (autoConnect) que ainda não terminou na janela inicial.
  const temCofre = DEMO_MODE || !!(process.env.NEXT_PUBLIC_MULTISIG_ADDRESS || cofre?.multisigPda);
  const esperandoChain = !DEMO_MODE && connected && temCofre && !chainInfo && chainCarregando;
  const carregando =
    !hidratado || (!DEMO_MODE && !cofreHidratado) || connecting || (!connected && !!wallet && !montadoHa) || esperandoChain;

  return {
    ...resolvido,
    temCofre,
    endereco,
    conectada: connected,
    carregando,
    sessaoDemo,
  };
}

export const ROTULO_PAPEL: Record<PapelAcesso, string> = {
  signatario: "Signatário da gestão atual",
  membro: "Membro da liga",
  visitante: "Visitante",
};
