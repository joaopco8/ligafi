"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Rotulo } from "@/components/ui";
import { formatBRL, formatDataCurta, iniciaisDe } from "@/lib/format";
import { liga, membros } from "@/lib/mock-data";
import type { StatusAnuidade } from "@/lib/types";

type Filtro = "todos" | StatusAnuidade;

const ANO = 2026;

export default function AnuidadePage() {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const pagos = membros.filter((m) => m.status === "pago");
  const pendentes = membros.filter((m) => m.status === "pendente");
  const arrecadado = pagos.length * liga.anuidade;
  const meta = membros.length * liga.anuidade;
  const pct = Math.round((arrecadado / meta) * 100);

  const lista = useMemo(
    () => (filtro === "todos" ? membros : membros.filter((m) => m.status === filtro)),
    [filtro],
  );

  const filtros: { id: Filtro; label: string; n: number }[] = [
    { id: "todos", label: "Todos", n: membros.length },
    { id: "pago", label: "Pagos", n: pagos.length },
    { id: "pendente", label: "Pendentes", n: pendentes.length },
  ];

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-end">
        <Link href="/painel" className="text-xs font-medium text-white/60 hover:text-white">
          ← Painel
        </Link>
      </div>

      <header className="mb-4">
        <Rotulo>Anuidade {ANO}</Rotulo>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">{membros.length} membros</h1>
        <p className="text-sm text-white/60">
          {formatBRL(liga.anuidade)} por membro · cai direto no cofre da entidade
        </p>
      </header>

      <Card className="mb-4 animate-fadeUp">
        <div className="flex items-end justify-between gap-2">
          <div>
            <Rotulo>Arrecadado</Rotulo>
            <p className="tabular mt-0.5 font-display text-2xl font-semibold tracking-[-0.01em] text-palha">{formatBRL(arrecadado)}</p>
          </div>
          <p className="tabular text-right text-xs text-white/50">
            meta {formatBRL(meta)}
            <br />
            <span className="font-semibold text-white">{pct}%</span> · {pagos.length} de {membros.length}
          </p>
        </div>
        <div
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={meta}
          aria-valuenow={arrecadado}
          aria-label="Arrecadação da anuidade"
        >
          <div className="h-full rounded-full bg-palha transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="tabular mt-2 text-[11px] text-white/50">
          Faltam {formatBRL(meta - arrecadado)} · {pendentes.length} pendente{pendentes.length !== 1 ? "s" : ""}
        </p>
      </Card>

      <div className="mb-3 flex gap-2" role="tablist" aria-label="Filtrar por status">
        {filtros.map((f) => {
          const ativo = f.id === filtro;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                ativo ? "border-palha bg-palha text-mata" : "border-white/15 text-white/80 hover:border-white/40"
              }`}
            >
              {f.label} <span className={`tabular ${ativo ? "text-mata/70" : "text-white/40"}`}>{f.n}</span>
            </button>
          );
        })}
      </div>

      <Card className="divide-y divide-white/[0.06] p-0">
        {lista.map((m, i) => {
          const pago = m.status === "pago";
          const descricao = `Anuidade ${ANO} — ${m.nome}`;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-2.5 animate-fadeUp"
              style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                  pago ? "bg-entrada/15 text-entrada" : "bg-white/10 text-white/70"
                }`}
              >
                {iniciaisDe(m.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.nome}</p>
                <p className="text-[11px] text-white/50">
                  {pago && m.pagoEm ? `pago em ${formatDataCurta(m.pagoEm)}` : "aguardando pagamento"}
                </p>
              </div>
              {pago ? (
                <span className="rounded-full bg-entrada/15 px-2 py-0.5 text-[11px] font-semibold text-entrada">Pago</span>
              ) : (
                <Link
                  href={`/cobranca?descricao=${encodeURIComponent(descricao)}&valor=${liga.anuidade}`}
                  className="rounded-full border border-palha/50 px-3 py-1 text-[11px] font-semibold text-palha hover:bg-palha/10"
                >
                  Cobrar
                </Link>
              )}
            </div>
          );
        })}
      </Card>

      <p className="mt-4 text-center text-[11px] text-white/40">
        Lista fictícia. Na versão real, o status vira “pago” quando o QR da cobrança é confirmado on-chain.
      </p>
    </main>
  );
}
