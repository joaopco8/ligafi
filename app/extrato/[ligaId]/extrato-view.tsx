"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Iniciais } from "@/components/assinaturas";
import { DrawerMovimento } from "@/components/drawer-movimento";
import { ResumoExtrato } from "@/components/resumo-extrato";
import { TODAS, TimelineGestoes } from "@/components/timeline-gestoes";
import { Card, Marca, Rotulo } from "@/components/ui";
import { categorias } from "@/lib/categorias";
import { formatBRL, formatData, formatMesAno } from "@/lib/format";
import { calcularSaldo, idsDe } from "@/lib/mock-data";
import { useGestaoAtual, useLigaFi } from "@/lib/store";
import type { Liga, Movimento } from "@/lib/types";

export function ExtratoView({ liga }: { liga: Liga }) {
  const movimentos = useLigaFi((s) => s.movimentos);
  const gestoes = useLigaFi((s) => s.gestoes);
  const hidratado = useLigaFi((s) => s.hidratado);
  const gestaoAtual = useGestaoAtual();

  // Gestão atual selecionada por padrão. Após rehidratar (pode ter havido
  // transição persistida), realinha com a gestão atual do store.
  const [filtro, setFiltro] = useState<string>(gestaoAtual.id);
  useEffect(() => {
    if (hidratado) setFiltro(useLigaFi.getState().gestaoAtualId);
  }, [hidratado]);

  const [selecionado, setSelecionado] = useState<Movimento | null>(null);
  const fechar = useCallback(() => setSelecionado(null), []);

  const saldo = calcularSaldo(movimentos, liga.saldoInicial);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { [TODAS]: movimentos.length };
    for (const m of movimentos) c[m.gestaoId] = (c[m.gestaoId] ?? 0) + 1;
    return c;
  }, [movimentos]);

  const filtrados = useMemo(
    () => (filtro === TODAS ? movimentos : movimentos.filter((m) => m.gestaoId === filtro)),
    [movimentos, filtro],
  );
  const tituloFiltro = filtro === TODAS ? "todas as gestões" : gestoes.find((g) => g.id === filtro)?.nome ?? "";

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-5 flex items-center justify-between">
        <Marca />
        <span className="rounded-full border border-entrada/40 bg-entrada/10 px-2.5 py-1 text-[11px] font-semibold text-entrada">
          ● Extrato público
        </span>
      </div>

      <Card className="mb-4 animate-fadeUp">
        <Rotulo>
          {liga.sigla} · {gestaoAtual.nome}
        </Rotulo>
        <h1 className="mt-1 font-display text-lg font-semibold leading-snug">{liga.nome}</h1>
        <p className="text-xs text-white/50">{liga.instituicao}</p>
        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <Rotulo>Saldo em caixa</Rotulo>
            <p className="tabular mt-0.5 font-display text-3xl font-semibold tracking-[-0.02em] text-palha">{formatBRL(saldo)}</p>
          </div>
          <Link href="/regras" className="text-right text-[11px] leading-tight text-white/50 hover:text-white">
            2 a 4 assinaturas
            <br />
            por saída, conforme o valor <span aria-hidden>→</span>
          </Link>
        </div>
      </Card>

      <section aria-label="Filtrar por gestão" className="mb-4">
        <Rotulo className="mb-2 px-1">Gestões · mesmo cofre desde {formatMesAno(liga.fundadaEm)}</Rotulo>
        <TimelineGestoes gestoes={gestoes} ativa={filtro} onChange={setFiltro} contagem={contagem} />
      </section>

      <div className="mb-4">
        <ResumoExtrato movimentos={filtrados} titulo={tituloFiltro} />
      </div>

      <section aria-label="Movimentos">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <Rotulo>Movimentos · {tituloFiltro}</Rotulo>
          <span className="text-xs text-white/40">toque para ver detalhes</span>
        </div>
        {filtrados.length === 0 ? (
          <Card className="text-center text-sm text-white/60">Nenhum movimento nesta gestão ainda.</Card>
        ) : (
          <Card className="divide-y divide-white/[0.06] p-0">
            {filtrados.map((m, i) => {
              const entrada = m.tipo === "entrada";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelecionado(m)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors animate-fadeUp hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs ${
                      entrada ? "text-entrada" : "text-saida/90"
                    }`}
                  >
                    {entrada ? "↓" : "↑"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] leading-snug text-white/90">{m.descricao}</span>
                    <span className="mt-1 flex items-center gap-2.5 text-xs text-white/45">
                      <time dateTime={m.data} className="tabular">
                        {formatData(m.data)}
                      </time>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categorias[m.categoria].cor }} />
                        {categorias[m.categoria].label}
                      </span>
                      {m.assinaturas.length > 0 ? (
                        <span className="flex items-center">
                          <span className="sr-only">Assinado por</span>
                          <Iniciais diretores={idsDe(m.assinaturas)} />
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className={`tabular mt-0.5 shrink-0 text-sm font-medium ${entrada ? "text-entrada" : "text-saida/90"}`}>
                    {entrada ? "+" : "−"} {formatBRL(m.valor)}
                  </span>
                </button>
              );
            })}
          </Card>
        )}
      </section>

      <footer className="mt-8 text-center">
        <p className="text-sm text-white/60">
          <span className="text-palha">🔗</span> link aberto, ninguém precisa de senha
        </p>
        <p className="mt-1 text-[11px] text-white/30">
          Cofre{" "}
          <span className="tabular">
            {liga.enderecoCofre.slice(0, 8)}…{liga.enderecoCofre.slice(-4)}
          </span>{" "}
          · {gestoes.length} gestões · {movimentos.length} movimentos
        </p>
      </footer>

      <DrawerMovimento movimento={selecionado} onClose={fechar} />
    </main>
  );
}
