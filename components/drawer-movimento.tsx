"use client";

import { useEffect, useState } from "react";
import { AvatarVazio, LinhaDiretor } from "@/components/assinaturas";
import { BadgeCategoria } from "@/components/resumo-extrato";
import { Rotulo } from "@/components/ui";
import { formatBRL, formatData, formatDataHora, formatHora } from "@/lib/format";
import { quorumPara } from "@/lib/regras";
import { useLigaFi } from "@/lib/store";
import { solscanUrl, truncarHash } from "@/lib/tx";
import type { Movimento } from "@/lib/types";

/**
 * Detalhe do movimento. Drawer lateral no desktop (sm+), bottom sheet no mobile.
 */
export function DrawerMovimento({ movimento, onClose }: { movimento: Movimento | null; onClose: () => void }) {
  const gestao = useLigaFi((s) => s.gestoes.find((g) => g.id === movimento?.gestaoId));
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!movimento) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [movimento, onClose]);

  if (!movimento) return null;

  const m = movimento;
  const entrada = m.tipo === "entrada";
  const quorum = entrada ? null : quorumPara(m.valor);
  const faltantes = quorum ? Math.max(0, quorum.necessarias - m.assinaturas.length) : 0;

  async function copiarHash() {
    try {
      await navigator.clipboard.writeText(m.txHash);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard indisponível: o hash já está visível na tela */
    }
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="drawer-titulo">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 animate-fadeIn bg-black/55" />
      <aside
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-slideUp flex-col overflow-y-auto rounded-t-3xl border-t border-white/10 bg-mata-card shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-full sm:max-w-sm sm:animate-slideIn sm:rounded-none sm:border-l sm:border-t-0"
      >
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-mata-card/95 backdrop-blur">
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <BadgeCategoria categoria={m.categoria} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${entrada ? "text-entrada" : "text-saida"}`}>
                {entrada ? "Entrada" : "Saída"}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel"
              className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          <div>
            <h2 id="drawer-titulo" className="font-display text-lg font-semibold leading-snug">
              {m.descricao}
            </h2>
            <p className={`tabular mt-2 font-display text-3xl font-semibold tracking-[-0.02em] ${entrada ? "text-entrada" : "text-saida"}`}>
              {entrada ? "+" : "−"} {formatBRL(m.valor)}
            </p>
            <p className="mt-1 text-xs text-white/50">
              {formatData(m.data)} · {gestao?.nome ?? m.gestaoId}
            </p>
          </div>

          <section>
            <Rotulo>Proposta</Rotulo>
            {entrada ? (
              <p className="mt-2 text-sm text-white/70">
                Recebido via <span className="text-white">{m.origem ?? "cobrança"}</span>. Entradas não exigem
                assinatura: caem direto no cofre da entidade.
              </p>
            ) : m.propostoPor ? (
              <ul className="mt-2">
                <LinhaDiretor
                  diretor={m.propostoPor}
                  tom="neutro"
                  direita={
                    <span className="tabular text-xs text-white/50">{m.propostoEm ? formatDataHora(m.propostoEm) : "—"}</span>
                  }
                />
              </ul>
            ) : null}
          </section>

          {quorum && (
            <section>
              <div className="flex items-baseline justify-between">
                <Rotulo>Assinaturas</Rotulo>
                <span className="tabular text-xs text-white/50">
                  {m.assinaturas.length} de {quorum.necessarias} · faixa {quorum.faixa.label}
                </span>
              </div>
              <ol className="mt-2 flex flex-col gap-2">
                {m.assinaturas.map((a, i) => (
                  <LinhaDiretor
                    key={a.diretor}
                    diretor={a.diretor}
                    direita={
                      <span className="flex items-center gap-2 text-xs">
                        <span className="tabular text-white/50">
                          {a.em.slice(0, 10) === m.data ? formatHora(a.em) : formatDataHora(a.em)}
                        </span>
                        <span className="text-entrada" aria-label={`assinatura ${i + 1}`}>
                          ✓
                        </span>
                      </span>
                    }
                  />
                ))}
                {Array.from({ length: faltantes }).map((_, i) => (
                  <li key={`vazio-${i}`} className="flex items-center gap-3 text-sm text-white/40">
                    <AvatarVazio tamanho="sm" />
                    <span>aguardando assinatura</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <Rotulo>Transação</Rotulo>
            <div className="mt-2 rounded-xl border border-white/10 bg-mata p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="tabular text-xs text-white/80">{truncarHash(m.txHash, 8)}</code>
                <button
                  type="button"
                  onClick={copiarHash}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-palha hover:bg-palha/10"
                >
                  {copiado ? "✓ copiado" : "copiar"}
                </button>
              </div>
              <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-white/35">{m.txHash}</p>
            </div>
            <a
              href={solscanUrl(m.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-palha/50 px-4 py-2.5 text-sm font-semibold text-palha hover:bg-palha/10"
            >
              Ver no Solscan <span aria-hidden>↗</span>
            </a>
            <p className="mt-2 text-center text-[10px] text-white/35">
              Hash fictício. Na versão real aponta para a transação executada pelo multisig.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
