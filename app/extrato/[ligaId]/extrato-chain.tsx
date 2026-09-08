"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeRede } from "@/components/top-bar";
import { Card, Rotulo } from "@/components/ui";
import { categorias } from "@/lib/categorias";
import { enderecoMultisigAtivo, useCofre } from "@/lib/cofre-store";
import { formatBRL, formatDataHora, truncarEndereco } from "@/lib/format";
import { BRL_POR_SOL, lamportsParaSol, solscanConta, solscanTx } from "@/lib/solana/config";
import type { MovimentoOnChain } from "@/lib/solana/historico";
import type { Categoria } from "@/lib/types";

const formatSol = (n: number) => `◎ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;

function dataDe(unix: number | null): string {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return formatDataHora(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`);
}

interface Resposta {
  movimentos: MovimentoOnChain[];
  proximoCursor: string | null;
  fonte: "helius" | "rpc";
  saldoLamports: number;
  erro?: string;
}

function categoriaValida(c: string): Categoria {
  return (Object.keys(categorias) as Categoria[]).includes(c as Categoria) ? (c as Categoria) : "outros";
}

/**
 * Extrato público on-chain. `ligaId` pode ser o endereço do vault (link
 * compartilhável) ou "lamed" (usa o cofre configurado neste navegador).
 */
export function ExtratoChain({ ligaId }: { ligaId: string }) {
  const cofre = useCofre((s) => s.cofre);
  const cofreHidratado = useCofre((s) => s.hidratado);

  const vault = useMemo(() => {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ligaId)) return ligaId;
    if (cofre?.vaultPda) return cofre.vaultPda;
    return null;
  }, [ligaId, cofre]);
  const multisigAtivo = enderecoMultisigAtivo(cofre);

  const [paginas, setPaginas] = useState<Resposta[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<MovimentoOnChain | null>(null);

  const carregar = useCallback(
    async (antesDe?: string) => {
      if (!vault) return;
      setCarregando(true);
      setErro(null);
      try {
        const q = new URLSearchParams({ vault, limite: "25" });
        if (antesDe) q.set("antesDe", antesDe);
        const r = await fetch(`/api/extrato?${q}`);
        const j = (await r.json()) as Resposta;
        if (!r.ok || j.erro) throw new Error(j.erro ?? `HTTP ${r.status}`);
        setPaginas((ps) => (antesDe ? [...ps, j] : [j]));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível ler o extrato.");
      } finally {
        setCarregando(false);
      }
    },
    [vault],
  );

  useEffect(() => {
    if (cofreHidratado || vault) carregar();
  }, [cofreHidratado, vault, carregar]);

  useEffect(() => {
    if (!selecionado) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelecionado(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecionado]);

  const movimentos = paginas.flatMap((p) => p.movimentos);
  const ultima = paginas[paginas.length - 1];
  const saldo = paginas[0] ? lamportsParaSol(paginas[0].saldoLamports) : null;
  const entradas = movimentos.filter((m) => m.tipo === "entrada" && !m.falhou).reduce((a, m) => a + m.lamports, 0);
  const saidas = movimentos.filter((m) => m.tipo === "saida" && !m.falhou).reduce((a, m) => a + m.lamports, 0);
  const porCategoria = Object.entries(
    movimentos
      .filter((m) => m.tipo === "saida" && !m.falhou)
      .reduce<Record<string, number>>((acc, m) => ((acc[categoriaValida(m.categoria)] = (acc[categoriaValida(m.categoria)] ?? 0) + m.lamports), acc), {}),
  )
    .map(([cat, lamports]) => ({ cat: cat as Categoria, lamports }))
    .sort((a, b) => b.lamports - a.lamports);

  if (cofreHidratado && !vault) {
    return (
      <main className="flex flex-1 flex-col">
        <header className="mb-4">
          <Rotulo>Extrato público</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">Nenhum cofre para mostrar</h1>
          <p className="mt-1 text-sm text-white/60">
            Abra o link com o endereço do vault (<code>/extrato/&lt;endereço&gt;</code>) ou configure um cofre em /setup.
          </p>
        </header>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <BadgeRede />
        <span className="rounded-full border border-entrada/40 bg-entrada/10 px-2.5 py-1 text-[11px] font-semibold text-entrada">● Extrato público</span>
      </div>

      <Card className="mb-4 animate-fadeUp">
        <Rotulo>{cofre?.nomeEntidade ?? "Cofre da entidade"}</Rotulo>
        {vault && (
          <a href={solscanConta(vault)} target="_blank" rel="noopener noreferrer" className="tabular mt-1 block text-xs text-white/55 hover:text-white">
            vault {truncarEndereco(vault, 6)} ↗
          </a>
        )}
        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <Rotulo>Saldo em caixa</Rotulo>
            {saldo === null ? (
              <div className="mt-2 h-8 w-32 animate-pulse rounded bg-white/10" />
            ) : (
              <>
                <p className="tabular mt-0.5 font-display text-3xl font-semibold tracking-[-0.02em] text-palha">{formatSol(saldo)}</p>
                <p className="tabular text-xs text-white/45">≈ {formatBRL(saldo * BRL_POR_SOL)}</p>
              </>
            )}
          </div>
          <p className="text-right text-[11px] leading-tight text-white/50">
            lido da devnet
            <br />
            {ultima ? (ultima.fonte === "helius" ? "via Helius" : "via RPC") : ""}
          </p>
        </div>
      </Card>

      {erro && (
        <div className="mb-4 rounded-2xl border border-saida/40 bg-saida/10 px-4 py-3 text-sm text-white/85" role="alert">
          {erro}{" "}
          <button type="button" onClick={() => carregar()} className="text-palha underline">
            tentar de novo
          </button>
        </div>
      )}

      <section className="mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3">
          <Rotulo>Entradas</Rotulo>
          <p className="tabular mt-1 text-sm font-semibold text-entrada">+ {formatSol(lamportsParaSol(entradas))}</p>
        </Card>
        <Card className="p-3">
          <Rotulo>Saídas</Rotulo>
          <p className="tabular mt-1 text-sm font-semibold text-saida">− {formatSol(lamportsParaSol(saidas))}</p>
        </Card>
        <Card className="p-3">
          <Rotulo>Resultado</Rotulo>
          <p className={`tabular mt-1 text-sm font-semibold ${entradas - saidas >= 0 ? "text-palha" : "text-saida"}`}>
            {entradas - saidas >= 0 ? "+" : "−"} {formatSol(lamportsParaSol(Math.abs(entradas - saidas)))}
          </p>
        </Card>
      </section>

      {porCategoria.length > 0 && (
        <Card className="mb-4">
          <Rotulo>Saídas por categoria</Rotulo>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label="Distribuição por categoria">
            {porCategoria.map((c) => (
              <span key={c.cat} style={{ width: `${(c.lamports / saidas) * 100}%`, backgroundColor: categorias[c.cat].cor }} className="h-full border-r border-mata-card last:border-r-0" />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {porCategoria.map((c) => (
              <li key={c.cat} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categorias[c.cat].cor }} />
                <span className="min-w-0 flex-1 truncate text-white/80">{categorias[c.cat].label}</span>
                <span className="tabular text-white/40">{Math.round((c.lamports / saidas) * 100)}%</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-label="Movimentos">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <Rotulo>Movimentos</Rotulo>
          <span className="tabular text-xs text-white/40">{movimentos.length} lidos</span>
        </div>
        {paginas.length === 0 && carregando ? (
          <div className="flex flex-col gap-2">
            <div className="h-16 animate-pulse rounded-2xl bg-mata-card" />
            <div className="h-16 animate-pulse rounded-2xl bg-mata-card" />
          </div>
        ) : movimentos.length === 0 ? (
          <Card className="text-center text-sm text-white/60">Nenhum movimento no vault ainda. Deposite SOL em /setup.</Card>
        ) : (
          <Card className="divide-y divide-white/[0.06] p-0">
            {movimentos.map((m, i) => {
              const entrada = m.tipo === "entrada";
              const cat = categoriaValida(m.categoria);
              return (
                <button
                  key={m.sig}
                  type="button"
                  onClick={() => setSelecionado(m)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors animate-fadeUp hover:bg-white/[0.04]"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <span aria-hidden className={`mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs ${entrada ? "text-entrada" : "text-saida/90"}`}>
                    {entrada ? "↓" : "↑"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] leading-snug ${m.falhou ? "text-white/40 line-through" : "text-white/90"}`}>{m.descricao}</span>
                    <span className="mt-1 flex items-center gap-2.5 text-xs text-white/45">
                      <span className="tabular">{dataDe(m.timestamp).slice(0, 10)}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categorias[cat].cor }} />
                        {categorias[cat].label}
                      </span>
                      {m.viaMultisig && <span className="text-palha/80">multisig</span>}
                    </span>
                  </span>
                  <span className={`tabular mt-0.5 shrink-0 text-right text-sm font-medium ${entrada ? "text-entrada" : "text-saida/90"}`}>
                    {entrada ? "+" : "−"} {formatSol(lamportsParaSol(m.lamports))}
                    <span className="block text-[10px] font-normal text-white/40">≈ {formatBRL(lamportsParaSol(m.lamports) * BRL_POR_SOL)}</span>
                  </span>
                </button>
              );
            })}
          </Card>
        )}
        {ultima?.proximoCursor && (
          <button
            type="button"
            onClick={() => carregar(ultima.proximoCursor!)}
            disabled={carregando}
            className="mt-3 w-full rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:border-white/40 hover:text-white disabled:opacity-50"
          >
            {carregando ? "Carregando…" : "Carregar mais antigos"}
          </button>
        )}
      </section>

      <footer className="mt-8 text-center">
        <p className="text-sm text-white/60">
          <span className="text-palha">🔗</span> link aberto, ninguém precisa de senha
        </p>
        <p className="mt-1 text-[11px] text-white/30">
          {multisigAtivo ? (
            <>
              multisig <span className="tabular">{truncarEndereco(multisigAtivo, 6)}</span> ·{" "}
            </>
          ) : null}
          cada linha é uma transação real na devnet
        </p>
      </footer>

      {selecionado && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fechar" onClick={() => setSelecionado(null)} className="absolute inset-0 animate-fadeIn bg-black/55" />
          <aside className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-slideUp flex-col overflow-y-auto rounded-t-3xl border-t border-white/10 bg-mata-card p-5 shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-full sm:max-w-sm sm:animate-slideIn sm:rounded-none sm:border-l sm:border-t-0">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${selecionado.tipo === "entrada" ? "text-entrada" : "text-saida"}`}>
                {selecionado.tipo === "entrada" ? "Entrada" : "Saída"}
                {selecionado.viaMultisig && " · executada pelo multisig"}
              </span>
              <button type="button" onClick={() => setSelecionado(null)} className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10">×</button>
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold leading-snug">{selecionado.descricao}</h2>
            <p className={`tabular mt-2 font-display text-3xl font-semibold tracking-[-0.02em] ${selecionado.tipo === "entrada" ? "text-entrada" : "text-saida"}`}>
              {selecionado.tipo === "entrada" ? "+" : "−"} {formatSol(lamportsParaSol(selecionado.lamports))}
            </p>
            <p className="tabular text-xs text-white/45">≈ {formatBRL(lamportsParaSol(selecionado.lamports) * BRL_POR_SOL)} · {dataDe(selecionado.timestamp)}</p>
            <dl className="mt-4 flex flex-col gap-3 border-t border-white/[0.06] pt-4 text-sm">
              {selecionado.contraparte && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/45">{selecionado.tipo === "entrada" ? "De" : "Para"}</dt>
                  <dd>
                    <a href={solscanConta(selecionado.contraparte)} target="_blank" rel="noopener noreferrer" className="tabular text-palha hover:underline">
                      {truncarEndereco(selecionado.contraparte, 8)} ↗
                    </a>
                  </dd>
                </div>
              )}
              {selecionado.memo && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-white/45">Memo on-chain</dt>
                  <dd className="break-all font-mono text-xs text-white/70">{selecionado.memo}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-white/45">Assinatura da transação</dt>
                <dd className="break-all font-mono text-[11px] text-white/60">{selecionado.sig}</dd>
              </div>
            </dl>
            <a
              href={solscanTx(selecionado.sig)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-palha/50 px-4 py-2.5 text-sm font-semibold text-palha hover:bg-palha/10"
            >
              Ver no Solscan <span aria-hidden>↗</span>
            </a>
          </aside>
        </div>
      )}
    </main>
  );
}
