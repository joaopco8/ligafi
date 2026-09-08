"use client";

import { Card, Rotulo } from "@/components/ui";
import { categorias, ordemCategorias } from "@/lib/categorias";
import { formatBRL } from "@/lib/format";
import type { Categoria, Movimento } from "@/lib/types";

/**
 * Cards de entradas / saídas / saldo do período + barra empilhada
 * (só CSS) com a distribuição das saídas por categoria.
 */
export function ResumoExtrato({ movimentos, titulo }: { movimentos: Movimento[]; titulo: string }) {
  const entradas = movimentos.filter((m) => m.tipo === "entrada").reduce((a, m) => a + m.valor, 0);
  const saidasLista = movimentos.filter((m) => m.tipo === "saida");
  const saidas = saidasLista.reduce((a, m) => a + m.valor, 0);
  const saldoPeriodo = entradas - saidas;

  const porCategoria = ordemCategorias
    .map((cat) => {
      const itens = saidasLista.filter((m) => m.categoria === cat);
      return { cat, quantidade: itens.length, valor: itens.reduce((a, m) => a + m.valor, 0) };
    })
    .filter((c) => c.quantidade > 0)
    .sort((a, b) => b.valor - a.valor);

  return (
    <section aria-label={`Resumo · ${titulo}`} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="animate-fadeUp p-3">
          <Rotulo>Entradas</Rotulo>
          <p className="tabular mt-1 text-sm font-medium text-entrada sm:text-base">+ {formatBRL(entradas)}</p>
        </Card>
        <Card className="animate-fadeUp p-3" style={{ animationDelay: "40ms" }}>
          <Rotulo>Saídas</Rotulo>
          <p className="tabular mt-1 text-sm font-medium text-saida sm:text-base">− {formatBRL(saidas)}</p>
        </Card>
        <Card className="animate-fadeUp p-3" style={{ animationDelay: "80ms" }}>
          <Rotulo>Saldo</Rotulo>
          <p className={`tabular mt-1 text-sm font-medium sm:text-base ${saldoPeriodo >= 0 ? "text-palha" : "text-saida"}`}>
            {saldoPeriodo >= 0 ? "+" : "−"} {formatBRL(Math.abs(saldoPeriodo))}
          </p>
        </Card>
      </div>

      <Card className="animate-fadeUp" style={{ animationDelay: "120ms" }}>
        <div className="flex items-baseline justify-between">
          <Rotulo>Saídas por categoria · {titulo}</Rotulo>
          <span className="tabular text-xs text-white/40">{saidasLista.length} saídas</span>
        </div>
        {porCategoria.length === 0 ? (
          <p className="mt-3 text-sm text-white/50">Nenhuma saída no período.</p>
        ) : (
          <>
            <div
              className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/10"
              role="img"
              aria-label={porCategoria.map((c) => `${categorias[c.cat].label} ${formatBRL(c.valor)}`).join(", ")}
            >
              {porCategoria.map((c) => (
                <span
                  key={c.cat}
                  title={`${categorias[c.cat].label}: ${formatBRL(c.valor)} (${Math.round((c.valor / saidas) * 100)}%)`}
                  style={{ width: `${(c.valor / saidas) * 100}%`, backgroundColor: categorias[c.cat].cor }}
                  className="h-full border-r border-mata-card last:border-r-0"
                />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {porCategoria.map((c) => (
                <li key={c.cat} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categorias[c.cat].cor }} />
                  <span className="min-w-0 flex-1 truncate text-white/80">{categorias[c.cat].label}</span>
                  <span className="tabular text-white/40">{Math.round((c.valor / saidas) * 100)}%</span>
                  <span className="tabular w-[4.4rem] text-right text-white/80">
                    {formatBRL(c.valor).replace("R$", "").trim()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}

export function BadgeCategoria({ categoria }: { categoria: Categoria }) {
  const c = categorias[categoria];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ borderColor: `${c.cor}55`, color: c.cor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.cor }} />
      {c.label}
    </span>
  );
}
