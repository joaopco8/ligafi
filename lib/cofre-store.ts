"use client";

/**
 * Cofre on-chain configurado neste browser. Separado do store de demo:
 * "resetar demo" não apaga o multisig criado.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MULTISIG_ENV } from "./solana/config";

export interface SignatarioLocal {
  endereco: string;
  nome: string;
  cargo: string;
}

export interface CofreLocal {
  multisigPda: string;
  vaultPda: string;
  nomeEntidade: string;
  threshold: number;
  signatarios: SignatarioLocal[];
  criadoEm: string;
  assinaturaCriacao?: string;
  /** Metadados off-chain de propostas: índice → descrição/categoria/destinatário. */
  propostas: Record<string, { descricao: string; categoria: string; destinatarioNome?: string }>;
}

interface CofreState {
  cofre: CofreLocal | null;
  hidratado: boolean;
  definirCofre: (c: CofreLocal) => void;
  anotarProposta: (indice: bigint | number | string, meta: CofreLocal["propostas"][string]) => void;
  renomearSignatario: (endereco: string, nome: string, cargo: string) => void;
  limparCofre: () => void;
}

export const useCofre = create<CofreState>()(
  persist(
    (set, get) => ({
      cofre: null,
      hidratado: false,
      definirCofre: (cofre) => set({ cofre }),
      anotarProposta: (indice, meta) => {
        const c = get().cofre;
        if (!c) return;
        set({ cofre: { ...c, propostas: { ...c.propostas, [String(indice)]: meta } } });
      },
      renomearSignatario: (endereco, nome, cargo) => {
        const c = get().cofre;
        if (!c) return;
        const existe = c.signatarios.some((s) => s.endereco === endereco);
        const signatarios = existe
          ? c.signatarios.map((s) => (s.endereco === endereco ? { ...s, nome, cargo } : s))
          : [...c.signatarios, { endereco, nome, cargo }];
        set({ cofre: { ...c, signatarios } });
      },
      limparCofre: () => set({ cofre: null }),
    }),
    {
      name: "ligafi:cofre",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ cofre: s.cofre }),
      onRehydrateStorage: () => () => useCofre.setState({ hidratado: true }),
    },
  ),
);

/** Endereço efetivo do multisig: env compartilhada tem prioridade. */
export function enderecoMultisigAtivo(cofre: CofreLocal | null): string | null {
  return MULTISIG_ENV ?? cofre?.multisigPda ?? null;
}
