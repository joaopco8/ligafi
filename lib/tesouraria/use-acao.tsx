"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErroLigaFi, traduzirErro } from "../solana/erros";

/**
 * Executa uma ação on-chain com estado de loading, erro humano e aviso.
 * O erro original vai para o console; a tela só vê a mensagem traduzida.
 * Passe `conectada` para avisar se a carteira cair no meio da ação.
 */
export function useAcao(opts: { conectada?: boolean } = {}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const conectadaRef = useRef(opts.conectada);
  conectadaRef.current = opts.conectada;

  // Carteira desconectou enquanto uma ação estava em andamento.
  useEffect(() => {
    if (opts.conectada === false && ocupado) {
      setErro("A carteira desconectou no meio da operação. Conecte de novo e tente outra vez.");
    }
  }, [opts.conectada, ocupado]);

  const rodar = useCallback(async <T,>(nome: string, fn: () => Promise<T>, avisoOk?: string): Promise<T | undefined> => {
    setErro(null);
    setAviso(null);
    if (conectadaRef.current === false) {
      setErro("Conecte a carteira antes de continuar.");
      return undefined;
    }
    setOcupado(nome);
    try {
      const r = await fn();
      if (avisoOk) setAviso(avisoOk);
      return r;
    } catch (e) {
      const t = traduzirErro(e);
      console.error(`[${nome}]`, t.codigo, e instanceof ErroLigaFi ? e.original ?? e : e);
      setErro(t.message);
      return undefined;
    } finally {
      setOcupado(null);
    }
  }, []);

  const limpar = useCallback(() => {
    setErro(null);
    setAviso(null);
  }, []);

  return { ocupado, erro, aviso, rodar, limpar };
}

export function Mensagens({ erro, aviso, onFechar }: { erro: string | null; aviso: string | null; onFechar?: () => void }) {
  if (!erro && !aviso) return null;
  return (
    <div
      role={erro ? "alert" : "status"}
      className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm text-white/85 ${
        erro ? "border-saida/40 bg-saida/10" : "border-entrada/40 bg-entrada/10"
      }`}
    >
      <span>{erro ?? aviso}</span>
      {onFechar && (
        <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="shrink-0 text-white/50 hover:text-white">
          ×
        </button>
      )}
    </div>
  );
}
