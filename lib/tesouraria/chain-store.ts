"use client";

/**
 * Estado on-chain compartilhado entre as telas (modo chain).
 * Sem persist: é cache de leitura da devnet, com polling.
 */

import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { enderecoMultisigAtivo, useCofre } from "../cofre-store";
import { traduzirErro } from "../solana/erros";
import { listarPropostas, lerMultisig, type MultisigInfo, type PropostaInfo } from "../solana/squads";

interface ChainState {
  endereco: string | null;
  info: MultisigInfo | null;
  propostas: PropostaInfo[];
  carregando: boolean;
  erro: string | null;
  atualizadoEm: number | null;
  atualizar: (connection: Connection, endereco: string | null) => Promise<void>;
}

let emAndamento: Promise<void> | null = null;

export const useChainStore = create<ChainState>((set) => ({
  endereco: null,
  info: null,
  propostas: [],
  carregando: false,
  erro: null,
  atualizadoEm: null,
  atualizar: async (connection, endereco) => {
    if (!endereco) {
      set({ endereco: null, info: null, propostas: [], erro: null, carregando: false });
      return;
    }
    if (emAndamento) return emAndamento;
    set({ carregando: true, endereco });
    emAndamento = (async () => {
      try {
        const pda = new PublicKey(endereco);
        const info = await lerMultisig(connection, pda);
        const propostas = await listarPropostas(connection, pda, { limite: 40 });
        set({ info, propostas, erro: null, atualizadoEm: Date.now() });
      } catch (e) {
        console.error(e);
        set({ erro: traduzirErro(e).message });
      } finally {
        set({ carregando: false });
        emAndamento = null;
      }
    })();
    return emAndamento;
  },
}));

const INTERVALO_MS = 15_000;

/**
 * Hook das telas: dispara leitura ao montar, faz polling e expõe `recarregar`.
 */
export function useChain() {
  const { connection } = useConnection();
  const cofre = useCofre((s) => s.cofre);
  const cofreHidratado = useCofre((s) => s.hidratado);
  const endereco = enderecoMultisigAtivo(cofre);
  const estado = useChainStore();

  const recarregar = useCallback(() => estado.atualizar(connection, endereco), [connection, endereco, estado.atualizar]);

  useEffect(() => {
    if (!cofreHidratado) return;
    recarregar();
    if (!endereco) return;
    const t = setInterval(recarregar, INTERVALO_MS);
    const onFoco = () => document.visibilityState === "visible" && recarregar();
    document.addEventListener("visibilitychange", onFoco);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onFoco);
    };
  }, [cofreHidratado, endereco, recarregar]);

  return {
    endereco,
    info: estado.endereco === endereco ? estado.info : null,
    propostas: estado.endereco === endereco ? estado.propostas : [],
    carregando: estado.carregando || !cofreHidratado,
    erro: estado.erro,
    atualizadoEm: estado.atualizadoEm,
    recarregar,
    connection,
  };
}
