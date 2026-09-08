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

export interface GestaoLocal {
  nome: string;
  inicio: string;
  fim?: string;
  signatarios: string[];
  /** Índice da ConfigTransaction que efetivou a troca (ausente na primeira). */
  indiceTransicao?: string;
}

export interface TransicaoLocal {
  indice: string;
  nomeNovaGestao: string;
  novos: SignatarioLocal[];
  concluidaEm?: string;
  snapshot?: {
    antes: { endereco: string; saldoLamports: number; propostas: number; signatarios: string[] };
    depois: { endereco: string; saldoLamports: number; propostas: number; signatarios: string[] };
  };
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
  propostas: Record<string, { descricao: string; categoria: string; destinatarioNome?: string; execucaoSig?: string }>;
  /** Gestões conhecidas neste navegador (nomes são off-chain; membros vêm da chain). */
  gestoes?: GestaoLocal[];
  transicao?: TransicaoLocal | null;
  ultimaTransicao?: TransicaoLocal | null;
  /** Cobranças Solana Pay geradas neste navegador. */
  cobrancas?: CobrancaLocal[];
}

export interface CobrancaLocal {
  reference: string;
  descricao: string;
  lamports: number;
  criadaEm: string;
  status?: "pendente" | "confirmado" | "valor_diferente";
  sig?: string;
  lamportsRecebidos?: number;
}

interface CofreState {
  cofre: CofreLocal | null;
  hidratado: boolean;
  definirCofre: (c: CofreLocal) => void;
  anotarProposta: (indice: bigint | number | string, meta: CofreLocal["propostas"][string]) => void;
  renomearSignatario: (endereco: string, nome: string, cargo: string) => void;
  atualizarCofre: (patch: Partial<CofreLocal>) => void;
  registrarCobranca: (c: CobrancaLocal) => void;
  atualizarCobranca: (reference: string, patch: Partial<CobrancaLocal>) => void;
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
      atualizarCofre: (patch) => {
        const c = get().cofre;
        if (c) set({ cofre: { ...c, ...patch } });
      },
      registrarCobranca: (cob) => {
        const c = get().cofre;
        if (c) set({ cofre: { ...c, cobrancas: [...(c.cobrancas ?? []).filter((x) => x.reference !== cob.reference), cob].slice(-50) } });
      },
      atualizarCobranca: (reference, patch) => {
        const c = get().cofre;
        if (c) set({ cofre: { ...c, cobrancas: (c.cobrancas ?? []).map((x) => (x.reference === reference ? { ...x, ...patch } : x)) } });
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
