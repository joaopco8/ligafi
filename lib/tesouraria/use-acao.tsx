"use client";

import { useCallback, useState } from "react";
import { traduzirErro } from "../solana/erros";

/**
 * Executa uma ação on-chain com estado de loading, erro humano e aviso.
 * O erro original vai para o console; a tela só vê a mensagem traduzida.
 */
export function useAcao() {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const rodar = useCallback(async <T,>(nome: string, fn: () => Promise<T>, avisoOk?: string): Promise<T | undefined> => {
    setErro(null);
    setAviso(null);
    setOcupado(nome);
    try {
      const r = await fn();
      if (avisoOk) setAviso(avisoOk);
      return r;
    } catch (e) {
      console.error(`[${nome}]`, e);
      setErro(traduzirErro(e).message);
      return undefined;
    } finally {
      setOcupado(null);
    }
  }, []);

  return { ocupado, erro, aviso, rodar, limpar: () => (setErro(null), setAviso(null)) };
}

export function Mensagens({ erro, aviso }: { erro: string | null; aviso: string | null }) {
  if (!erro && !aviso) return null;
  return (
    <div
      role={erro ? "alert" : "status"}
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm text-white/85 ${
        erro ? "border-saida/40 bg-saida/10" : "border-entrada/40 bg-entrada/10"
      }`}
    >
      {erro ?? aviso}
    </div>
  );
}
