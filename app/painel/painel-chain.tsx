"use client";

import Link from "next/link";
import { SlotsQuorumEnderecos } from "@/components/assinaturas";
import { BadgeCategoria } from "@/components/resumo-extrato";
import { BadgeRede } from "@/components/top-bar";
import { BotaoLink, Card, Rotulo } from "@/components/ui";
import { useIdentidade } from "@/lib/auth";
import { useCofre } from "@/lib/cofre-store";
import { formatBRL, truncarEndereco } from "@/lib/format";
import { liga } from "@/lib/mock-data";
import { BRL_POR_SOL, lamportsParaSol, solscanConta } from "@/lib/solana/config";
import { useChain } from "@/lib/tesouraria/chain-store";
import { mapearProposta, type PropostaUI } from "@/lib/tesouraria/mapear";

export const formatSol = (n: number) => `◎ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;

export function PainelChain() {
  const { info, propostas, carregando, erro, atualizadoEm, recarregar } = useChain();
  const cofre = useCofre((s) => s.cofre);
  const identidade = useIdentidade();

  const lista: PropostaUI[] = info ? propostas.map((p) => mapearProposta(p, info.threshold, cofre)) : [];
  const pendentes = lista.filter((p) => p.status === "pendente" || p.status === "aprovada");
  const encerradas = lista.filter((p) => p.status !== "pendente" && p.status !== "aprovada");
  const saldoSol = info ? lamportsParaSol(info.saldoVaultLamports) : 0;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-end">
        <nav className="flex items-center gap-3 text-xs font-medium text-white/60">
          <Link href="/setup" className="underline-offset-4 hover:text-white hover:underline">
            Cofre
          </Link>
          <Link href="/gestao" className="underline-offset-4 hover:text-white hover:underline">
            Gestão
          </Link>
          <Link href="/regras" className="underline-offset-4 hover:text-white hover:underline">
            Regras
          </Link>
          <Link href={info ? `/extrato/${info.vaultPda.toBase58()}` : `/extrato/${liga.id}`} className="underline-offset-4 hover:text-white hover:underline">
            Extrato →
          </Link>
        </nav>
      </div>

      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Rotulo>Painel da diretoria</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">{cofre?.nomeEntidade ?? "Entidade"}</h1>
          {info && (
            <a
              href={solscanConta(info.vaultPda.toBase58())}
              target="_blank"
              rel="noopener noreferrer"
              className="tabular text-xs text-white/50 hover:text-white"
            >
              vault {truncarEndereco(info.vaultPda.toBase58(), 6)} ↗
            </a>
          )}
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-entrada/40 px-2.5 py-1 text-[11px] font-medium text-entrada">
          <span className="h-1.5 w-1.5 rounded-full bg-entrada" />
          {identidade.endereco ? truncarEndereco(identidade.endereco) : "—"}
        </span>
      </header>

      {erro && (
        <div className="mb-4 rounded-2xl border border-saida/40 bg-saida/10 px-4 py-3 text-sm text-white/85" role="alert">
          {erro}{" "}
          <button type="button" onClick={recarregar} className="text-palha underline">
            tentar de novo
          </button>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="animate-fadeUp">
          <div className="flex items-center justify-between">
            <Rotulo>Saldo do cofre</Rotulo>
            <BadgeRede />
          </div>
          {info ? (
            <>
              <p className="tabular mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-palha">{formatSol(saldoSol)}</p>
              <p className="tabular mt-1 text-[11px] text-white/50">≈ {formatBRL(saldoSol * BRL_POR_SOL)}</p>
            </>
          ) : (
            <div className="mt-2 h-8 w-32 animate-pulse rounded bg-white/10" />
          )}
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "60ms" }}>
          <Rotulo>Quórum</Rotulo>
          {info ? (
            <>
              <p className="tabular mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">
                {info.threshold} de {info.membros.length}
              </p>
              <p className="mt-1 text-[11px] text-white/50">
                {info.governancaOnChain ? "✓ governança on-chain" : "✗ tem config_authority"}
              </p>
            </>
          ) : (
            <div className="mt-2 h-8 w-20 animate-pulse rounded bg-white/10" />
          )}
        </Card>
      </div>

      <section aria-labelledby="pendentes" className="mb-6 mt-2">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 id="pendentes">
            <Rotulo>Propostas abertas</Rotulo>
          </h2>
          <button type="button" onClick={recarregar} className="text-xs text-white/40 hover:text-white" disabled={carregando}>
            {carregando ? "lendo…" : atualizadoEm ? `atualizado ${new Date(atualizadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "recarregar"}
          </button>
        </div>

        {!info && carregando ? (
          <div className="flex flex-col gap-2">
            <div className="h-20 animate-pulse rounded-2xl bg-mata-card" />
            <div className="h-20 animate-pulse rounded-2xl bg-mata-card" />
          </div>
        ) : pendentes.length === 0 ? (
          <Card className="text-center text-sm text-white/60">Nenhuma proposta aguardando assinatura.</Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendentes.map((p, i) => (
              <li key={p.id} className="animate-fadeUp" style={{ animationDelay: `${i * 50}ms` }}>
                <Link
                  href={`/pagamento/${p.id}`}
                  className="block rounded-2xl border border-mata-border/60 bg-mata-card p-4 transition-colors hover:border-palha/40 active:bg-mata-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-snug">{p.descricao}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-white/50">
                        <span className="truncate">
                          #{p.id}
                          {p.destinatario && ` · ${p.destinatarioNome ?? truncarEndereco(p.destinatario)}`}
                        </span>
                        {p.tipo === "gestao" ? (
                          <span className="rounded-full border border-palha/40 px-2 py-0.5 text-[10px] font-semibold text-palha">Gestão</span>
                        ) : (
                          <BadgeCategoria categoria={p.categoria} />
                        )}
                      </p>
                    </div>
                    {p.valorSol !== undefined && (
                      <p className="tabular shrink-0 text-right font-medium text-saida">
                        − {formatSol(p.valorSol)}
                        <span className="block text-[10px] font-normal text-white/40">≈ {formatBRL(p.valorSol * BRL_POR_SOL)}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <SlotsQuorumEnderecos assinaturas={p.aprovacoes} necessarias={p.necessarias} />
                    <span className={`text-right text-xs font-semibold ${p.status === "aprovada" ? "text-entrada" : p.necessarias - p.aprovacoes.length === 1 ? "text-palha" : "text-white/60"}`}>
                      {p.status === "aprovada" ? "quórum atingido · executar" : `${p.aprovacoes.length} de ${p.necessarias} assinaturas`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {encerradas.length > 0 && (
        <section aria-labelledby="encerradas" className="mb-6">
          <h2 id="encerradas" className="mb-2 px-1">
            <Rotulo>Encerradas</Rotulo>
          </h2>
          <ul className="flex flex-col gap-2">
            {encerradas.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pagamento/${p.id}`}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-mata-card/60 px-4 py-3 text-sm"
                >
                  <span className="min-w-0 truncate text-white/80">
                    <span className="text-white/40">#{p.id} </span>
                    {p.descricao}
                  </span>
                  <span
                    className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      p.status === "executada" ? "bg-entrada/15 text-entrada" : "bg-white/10 text-white/60"
                    }`}
                  >
                    {p.status === "executada" ? "Executada" : p.status === "rejeitada" ? "Rejeitada" : p.status === "obsoleta" ? "Obsoleta" : "Cancelada"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <BotaoLink href="/pagamento/nova">+ Nova proposta de pagamento</BotaoLink>
        <BotaoLink href="/cobranca" variante="secondary">
          + Nova cobrança
        </BotaoLink>
        <p className="text-center text-[11px] text-white/40">
          Nenhum pagamento sai sem {info?.threshold ?? 3} de {info?.membros.length ?? 5} assinaturas. Verificado pela rede.
        </p>
      </div>
    </main>
  );
}
