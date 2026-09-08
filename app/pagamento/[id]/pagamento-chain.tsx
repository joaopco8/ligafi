"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AvatarVazio, LinhaSignatario, SlotsQuorumEnderecos } from "@/components/assinaturas";
import { ConfirmacaoOverlay } from "@/components/confirmacao";
import { BadgeCategoria } from "@/components/resumo-extrato";
import { BadgeRede } from "@/components/top-bar";
import { Botao, BotaoLink, Card, Rotulo, Topo } from "@/components/ui";
import { useCofre } from "@/lib/cofre-store";
import { formatBRL, formatDataHora, truncarEndereco } from "@/lib/format";
import { liga } from "@/lib/mock-data";
import { BRL_POR_SOL, solscanConta, solscanTx } from "@/lib/solana/config";
import { aprovarProposta, assinadorWallet, executarProposta, lerProposta, rejeitarProposta, type PropostaInfo } from "@/lib/solana/squads";
import { useChain } from "@/lib/tesouraria/chain-store";
import { mapearProposta, nomeDe } from "@/lib/tesouraria/mapear";
import { Mensagens, useAcao } from "@/lib/tesouraria/use-acao";

const formatSol = (n: number) => `◎ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;

function dataDe(unix?: number): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return formatDataHora(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`);
}

export function PagamentoChain({ id }: { id: string }) {
  const wallet = useWallet();
  const { info, propostas, connection, recarregar, carregando } = useChain();
  const cofre = useCofre((s) => s.cofre);
  const anotarProposta = useCofre((s) => s.anotarProposta);
  const { ocupado, erro, aviso, rodar, limpar } = useAcao({ conectada: wallet.connected });
  const [confirmacao, setConfirmacao] = useState<null | "assinado" | "executado">(null);
  /** Aprovação otimista: mostra o check antes de a devnet devolver a leitura. */
  const [otimista, setOtimista] = useState<string | null>(null);
  const [avulsa, setAvulsa] = useState<PropostaInfo | null>(null);

  let indice: bigint | null = null;
  try {
    indice = BigInt(id);
  } catch {
    indice = null;
  }

  const naLista = propostas.find((p) => indice !== null && p.transactionIndex === indice) ?? null;

  // Fora da janela listada: busca individual.
  useEffect(() => {
    if (naLista || !info || indice === null || indice < 1n || indice > info.transactionIndex) return;
    lerProposta(connection, info.multisigPda, indice).then(setAvulsa).catch(() => setAvulsa(null));
  }, [naLista, info, indice, connection]);

  const bruta = naLista ?? avulsa;
  const p = useMemo(() => {
    if (!bruta || !info) return null;
    const m = mapearProposta(bruta, info.threshold, cofre);
    if (otimista && !m.aprovacoes.includes(otimista) && m.status === "pendente") {
      const aprovacoes = [...m.aprovacoes, otimista];
      return { ...m, aprovacoes, status: aprovacoes.length >= m.necessarias ? ("aprovada" as const) : m.status };
    }
    return m;
  }, [bruta, info, cofre, otimista]);

  useEffect(() => {
    // Leitura real chegou com a aprovação: descarta o otimismo.
    if (otimista && bruta?.aprovacoes.some((k) => k.toBase58() === otimista)) setOtimista(null);
  }, [bruta, otimista]);
  const meta = cofre?.propostas[id];
  const eu = wallet.publicKey?.toBase58() ?? null;
  const souMembro = !!eu && !!info && info.membros.some((m) => m.key.toBase58() === eu);

  if (indice === null || (info && (indice < 1n || indice > info.transactionIndex))) {
    return (
      <main className="flex flex-1 flex-col">
        <Topo voltar={{ href: "/painel", label: "Painel" }} titulo="Proposta não encontrada" />
        <Card className="text-sm text-white/60">Não existe proposta #{id} neste cofre.</Card>
      </main>
    );
  }

  if (!p) {
    return (
      <main className="flex flex-1 flex-col gap-3" aria-busy="true">
        <Topo voltar={{ href: "/painel", label: "Painel" }} titulo={`Proposta #${id}`} sub={carregando ? "Lendo a devnet…" : "Aguardando dados do cofre"} />
        <div className="h-28 animate-pulse rounded-2xl bg-mata-card" />
        <div className="h-40 animate-pulse rounded-2xl bg-mata-card" />
      </main>
    );
  }

  const jaAssinei = !!eu && p.aprovacoes.includes(eu);
  const jaRejeitei = !!eu && p.rejeicoes.includes(eu);
  const aberta = p.status === "pendente";
  const aprovada = p.status === "aprovada";
  const executada = p.status === "executada";
  const podeAssinar = souMembro && aberta && !jaAssinei && !jaRejeitei;
  const podeExecutar = souMembro && aprovada;
  const faltam = Math.max(0, p.necessarias - p.aprovacoes.length);
  const gestao = p.tipo === "gestao";

  async function aprovar() {
    if (!info) return;
    const sig = await rodar("aprovar", () =>
      aprovarProposta({ connection, assinador: assinadorWallet(wallet), multisigPda: info.multisigPda, transactionIndex: p!.indice }),
    );
    if (!sig) return;
    if (eu) setOtimista(eu);
    setConfirmacao("assinado");
    recarregar().catch(() => {});
  }

  async function rejeitar() {
    if (!info) return;
    const sig = await rodar(
      "rejeitar",
      () => rejeitarProposta({ connection, assinador: assinadorWallet(wallet), multisigPda: info.multisigPda, transactionIndex: p!.indice }),
      "Rejeição registrada na chain.",
    );
    if (sig) await recarregar();
  }

  async function executar() {
    if (!info) return;
    const sig = await rodar("executar", () =>
      executarProposta({ connection, assinador: assinadorWallet(wallet), multisigPda: info.multisigPda, transactionIndex: p!.indice }),
    );
    if (!sig) return;
    anotarProposta(p!.indice, { descricao: meta?.descricao ?? p!.descricao, categoria: meta?.categoria ?? p!.categoria, destinatarioNome: meta?.destinatarioNome, execucaoSig: sig });
    await recarregar();
    setConfirmacao("executado");
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <Topo
        voltar={{ href: "/painel", label: "Painel" }}
        titulo={p.descricao}
        sub={`Proposta #${p.id}${p.criador ? ` · por ${nomeDe(p.criador, cofre?.signatarios ?? [])}` : ""}`}
        acao={<BadgeRede className="mt-1" />}
      />

      <Mensagens erro={erro} aviso={aviso} onFechar={limpar} />

      <Card className="mb-4 animate-fadeUp" aria-busy={!!ocupado}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <Rotulo>{gestao ? "Mudança" : "Valor"}</Rotulo>
            {p.valorSol !== undefined ? (
              <>
                <p className="tabular mt-0.5 font-display text-3xl font-semibold tracking-[-0.02em] text-saida">− {formatSol(p.valorSol)}</p>
                <p className="tabular text-xs text-white/45">≈ {formatBRL(p.valorSol * BRL_POR_SOL)}</p>
              </>
            ) : (
              <p className="mt-0.5 font-display text-lg font-semibold">{gestao ? "Troca de signatários" : "Proposta"}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                executada ? "bg-entrada/15 text-entrada" : aprovada ? "bg-entrada/15 text-entrada" : aberta ? "bg-palha/15 text-palha" : "bg-white/10 text-white/60"
              }`}
            >
              {executada ? "Executada" : aprovada ? "Aprovada · executar" : aberta ? "Pendente" : p.status}
            </span>
            {gestao ? (
              <span className="rounded-full border border-palha/40 px-2 py-0.5 text-[10px] font-semibold text-palha">Gestão</span>
            ) : (
              <BadgeCategoria categoria={p.categoria} />
            )}
          </div>
        </div>

        {p.destinatario && (
          <div className="mt-3 border-t border-white/[0.06] pt-3 text-sm">
            <span className="text-white/50">Para </span>
            {p.destinatarioNome && <span>{p.destinatarioNome} · </span>}
            <a href={solscanConta(p.destinatario)} target="_blank" rel="noopener noreferrer" className="tabular text-palha hover:underline">
              {truncarEndereco(p.destinatario, 6)} ↗
            </a>
          </div>
        )}

        {gestao && p.acoes && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3 text-sm">
            {p.acoes.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase ${a.tipo === "AddMember" ? "text-entrada" : a.tipo === "RemoveMember" ? "text-saida" : "text-palha"}`}>
                  {a.tipo === "AddMember" ? "entra" : a.tipo === "RemoveMember" ? "sai" : a.tipo}
                </span>
                {a.chave ? (
                  <span className="min-w-0 truncate">
                    {nomeDe(a.chave.toBase58(), cofre?.signatarios ?? [])} <code className="text-[11px] text-white/40">{truncarEndereco(a.chave.toBase58())}</code>
                  </span>
                ) : (
                  <span>{a.valor}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {p.criador && (
          <ul className="mt-3 border-t border-white/[0.06] pt-3">
            <LinhaSignatario endereco={p.criador} tom="neutro" direita={<span className="text-[10px] font-semibold uppercase text-white/40">propôs</span>} />
          </ul>
        )}
      </Card>

      <Card className="mb-4 animate-fadeUp" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between">
          <Rotulo>Assinaturas</Rotulo>
          <span className="tabular text-sm font-semibold">
            {Math.min(p.aprovacoes.length, p.necessarias)} de {p.necessarias}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-white/50">
          Threshold do multisig, verificado pela rede.{" "}
          <Link href="/regras" className="text-palha hover:underline">
            ver regras
          </Link>
        </p>
        <div className="mt-3">
          <SlotsQuorumEnderecos assinaturas={p.aprovacoes} necessarias={p.necessarias} tamanho="lg" />
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {p.aprovacoes.map((a) => (
            <LinhaSignatario key={a} endereco={a} destaque={a === eu ? "você" : undefined} direita={<span className="text-entrada">✓</span>} />
          ))}
          {p.rejeicoes.map((a) => (
            <LinhaSignatario key={a} endereco={a} tom="neutro" direita={<span className="text-saida">✗ rejeitou</span>} />
          ))}
          {aberta &&
            Array.from({ length: faltam }).map((_, i) => (
              <li key={`vazio-${i}`} className="flex items-center gap-3 text-sm text-white/40">
                <AvatarVazio tamanho="sm" />
                <span>aguardando assinatura</span>
              </li>
            ))}
        </ul>
        {p.statusEm && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/50">
            {executada ? "Executada" : aprovada ? "Quórum atingido" : "Último status"} em {dataDe(p.statusEm)}.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          <a href={solscanConta(p.proposalPda)} target="_blank" rel="noopener noreferrer" className="text-palha hover:underline">
            conta da proposta ↗
          </a>
          {meta?.execucaoSig && (
            <a href={solscanTx(meta.execucaoSig)} target="_blank" rel="noopener noreferrer" className="text-palha hover:underline">
              transação de execução ↗
            </a>
          )}
        </div>
      </Card>

      {!souMembro && !executada && (
        <Card className="mb-4 text-sm text-white/60">Sua carteira não é signatária deste cofre: você pode acompanhar, não assinar.</Card>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {executada ? (
          <BotaoLink href={gestao ? "/gestao" : `/extrato/${liga.id}`}>{gestao ? "Ver a gestão" : "Ver no extrato público"}</BotaoLink>
        ) : podeExecutar ? (
          <Botao onClick={executar} disabled={!!ocupado}>
            {ocupado === "executar" ? "Executando na devnet…" : gestao ? "Executar a troca de gestão" : "Executar pagamento"}
          </Botao>
        ) : (
          <Botao onClick={aprovar} disabled={!podeAssinar || !!ocupado}>
            {ocupado === "aprovar" ? "Assinando…" : jaAssinei ? "Você já assinou" : jaRejeitei ? "Você rejeitou" : faltam === 1 ? "Assinar (atinge o quórum)" : "Assinar"}
          </Botao>
        )}
        {aberta && souMembro && !jaAssinei && !jaRejeitei && (
          <button type="button" onClick={rejeitar} disabled={!!ocupado} className="py-2 text-center text-sm text-white/50 hover:text-saida">
            {ocupado === "rejeitar" ? "Registrando…" : "Rejeitar proposta"}
          </button>
        )}
        <Link href="/painel" className="py-2 text-center text-sm text-white/60 hover:text-white">
          Voltar ao painel
        </Link>
      </div>

      {confirmacao && (
        <ConfirmacaoOverlay
          titulo={confirmacao === "executado" ? (gestao ? "Gestão transferida" : "Pagamento executado") : "Assinatura registrada"}
          texto={
            confirmacao === "executado"
              ? gestao
                ? "Mesmo cofre, mesmo saldo, mesmo histórico. Só mudaram os signatários."
                : "Transferência confirmada na devnet. Já está no extrato."
              : `${p.aprovacoes.length} de ${p.necessarias} assinaturas.`
          }
          tom={confirmacao === "executado" ? "entrada" : "palha"}
          duracaoMs={confirmacao === "executado" ? 2600 : 1600}
          onFim={() => setConfirmacao(null)}
        />
      )}
    </main>
  );
}
