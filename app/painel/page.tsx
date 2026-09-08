"use client";

import Link from "next/link";
import { SlotsQuorum } from "@/components/assinaturas";
import { RendimentoCard } from "@/components/rendimento-card";
import { BadgeCategoria } from "@/components/resumo-extrato";
import { BotaoLink, Card, Rotulo } from "@/components/ui";
import { formatBRL, formatDataCurta } from "@/lib/format";
import { calcularSaldo, idsDe, liga } from "@/lib/mock-data";
import { quorumPara, temConselho } from "@/lib/regras";
import { useGestaoAtual, useLigaFi } from "@/lib/store";
import { truncarEndereco } from "@/lib/format";

export default function PainelPage() {
  const movimentos = useLigaFi((s) => s.movimentos);
  const pagamentos = useLigaFi((s) => s.pagamentos);
  const diretores = useLigaFi((s) => s.diretores);
  const aplicacao = useLigaFi((s) => s.aplicacao);
  const transicao = useLigaFi((s) => s.transicao);
  const carteira = useLigaFi((s) => s.carteira);
  const gestaoAtual = useGestaoAtual();

  const saldoTotal = calcularSaldo(movimentos);
  const pendentes = pagamentos.filter((p) => p.status === "pendente");
  const executados = pagamentos.filter((p) => p.status === "executado");

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-end">
        <nav className="flex items-center gap-3 text-xs font-medium text-white/60">
          <Link href="/anuidade" className="underline-offset-4 hover:text-white hover:underline">
            Anuidade
          </Link>
          <Link href="/gestao" className="underline-offset-4 hover:text-white hover:underline">
            Gestão
          </Link>
          <Link href="/regras" className="underline-offset-4 hover:text-white hover:underline">
            Regras
          </Link>
          <Link href={`/extrato/${liga.id}`} className="underline-offset-4 hover:text-white hover:underline">
            Extrato →
          </Link>
        </nav>
      </div>

      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Rotulo>Painel da diretoria · {gestaoAtual.nome}</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">{liga.sigla}</h1>
          <p className="text-sm text-white/60">{liga.nome}</p>
        </div>
        <Link
          href="/entrar"
          className={`mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            carteira && carteira.rede !== "demo"
              ? "border-entrada/40 text-entrada"
              : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${carteira && carteira.rede !== "demo" ? "bg-entrada" : "bg-white/30"}`} />
          {carteira && carteira.rede !== "demo"
            ? `${carteira.nome} · ${truncarEndereco(carteira.endereco)}`
            : carteira
              ? "modo demo"
              : "conectar carteira"}
        </Link>
      </header>

      {transicao && (
        <Link
          href="/gestao"
          className="mb-4 flex items-center justify-between rounded-2xl border border-palha/40 bg-palha/[0.06] px-4 py-3 text-sm"
        >
          <span>
            Transição para <strong>{transicao.nomeNovaGestao}</strong> aguardando assinaturas
          </span>
          <span className="tabular shrink-0 text-xs font-semibold text-palha">
            {transicao.assinaturas.length} de {liga.quorumGovernanca.necessarias} →
          </span>
        </Link>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card className="animate-fadeUp">
          <Rotulo>Saldo total</Rotulo>
          <p className="tabular mt-1 font-display text-2xl font-semibold tracking-[-0.01em] text-palha">{formatBRL(saldoTotal)}</p>
          <p className="mt-1 text-[11px] text-white/50">No cofre da entidade</p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "60ms" }}>
          <Rotulo>Em conta</Rotulo>
          <p className="tabular mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">{formatBRL(Math.max(0, saldoTotal - aplicacao.valor))}</p>
          <p className="tabular mt-1 text-[11px] text-white/50">{formatBRL(aplicacao.valor)} aplicado</p>
        </Card>
      </div>

      <div className="mb-5">
        <RendimentoCard />
      </div>

      <section aria-labelledby="pendentes" className="mb-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 id="pendentes">
            <Rotulo>Pagamentos pendentes</Rotulo>
          </h2>
          <Link href="/regras" className="text-xs text-white/40 hover:text-white">
            quórum 3 de 5 →
          </Link>
        </div>

        {pendentes.length === 0 ? (
          <Card className="text-center text-sm text-white/60">Nenhum pagamento aguardando assinatura.</Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendentes.map((p, i) => {
              const q = quorumPara(p.valor);
              const n = p.assinaturas.length;
              const faltaConselho = q.exigeConselho && !temConselho(p.assinaturas, diretores);
              const faltaUma = q.necessarias - n === 1 && !faltaConselho;
              const resgate = p.natureza === "resgate";
              return (
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
                            {p.destinatario} · {formatDataCurta(p.criadoEm)}
                          </span>
                          {resgate ? (
                            <span className="rounded-full border border-entrada/40 px-2 py-0.5 text-[10px] font-semibold text-entrada">
                              Resgate
                            </span>
                          ) : (
                            <BadgeCategoria categoria={p.categoria} />
                          )}
                        </p>
                      </div>
                      <p className={`tabular shrink-0 font-semibold ${resgate ? "text-entrada" : "text-saida"}`}>
                        {resgate ? "↺" : "−"} {formatBRL(p.valor)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <SlotsQuorum assinaturas={idsDe(p.assinaturas)} necessarias={q.necessarias} />
                      <span className={`text-right text-xs font-semibold ${faltaUma ? "text-palha" : "text-white/60"}`}>
                        {n} de {q.necessarias} assinaturas
                        {faltaUma && " · falta 1"}
                        {q.exigeConselho && (
                          <span className={`block text-[10px] font-medium ${faltaConselho ? "text-palha/80" : "text-entrada"}`}>
                            {faltaConselho ? "conselho fiscal obrigatório" : "✓ conselho fiscal"}
                          </span>
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {executados.length > 0 && (
        <section aria-labelledby="executados" className="mb-6">
          <h2 id="executados" className="mb-2 px-1">
            <Rotulo>Executados</Rotulo>
          </h2>
          <ul className="flex flex-col gap-2">
            {executados.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pagamento/${p.id}`}
                  className="flex items-center justify-between rounded-2xl border border-entrada/20 bg-mata-card/60 px-4 py-3 text-sm"
                >
                  <span className="truncate text-white/80">{p.descricao}</span>
                  <span className="ml-3 shrink-0 rounded-full bg-entrada/15 px-2 py-0.5 text-[11px] font-semibold text-entrada">
                    {p.natureza === "resgate" ? "Resgatado" : "Executado"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <BotaoLink href="/cobranca">+ Nova cobrança</BotaoLink>
        <p className="text-center text-[11px] text-white/40">
          Nenhum pagamento sai sem 3 de 5 assinaturas. O extrato é público.
        </p>
      </div>
    </main>
  );
}
