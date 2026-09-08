"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LinhaSignatario, SlotsQuorumEnderecos } from "@/components/assinaturas";
import { ConfirmacaoOverlay } from "@/components/confirmacao";
import { BadgeRede } from "@/components/top-bar";
import { Botao, Card, Rotulo } from "@/components/ui";
import { useCofre, type SignatarioLocal, type TransicaoLocal } from "@/lib/cofre-store";
import { agoraISO, formatBRL, formatDataHora, iniciaisDe, truncarEndereco } from "@/lib/format";
import { ASSENTOS, PAPEL_LABEL } from "@/lib/regras";
import { BRL_POR_SOL, lamportsParaSol, solscanConta } from "@/lib/solana/config";
import { aprovarProposta, assinadorWallet, executarProposta, lerMultisig, proporTrocaDeSignatarios } from "@/lib/solana/squads";
import { useChain } from "@/lib/tesouraria/chain-store";
import { mapearProposta } from "@/lib/tesouraria/mapear";
import { Mensagens, useAcao } from "@/lib/tesouraria/use-acao";

const formatSol = (n: number) => `◎ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;

type Linha = { nome: string; endereco: string };

function pubkeyValida(s: string): boolean {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

export function GestaoChain() {
  const wallet = useWallet();
  const { info, propostas, connection, recarregar } = useChain();
  const cofre = useCofre((s) => s.cofre);
  const atualizarCofre = useCofre((s) => s.atualizarCofre);
  const anotarProposta = useCofre((s) => s.anotarProposta);
  const renomearSignatario = useCofre((s) => s.renomearSignatario);
  const { ocupado, erro, aviso, rodar } = useAcao();

  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [nomeNova, setNomeNova] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>(() => ASSENTOS.map(() => ({ nome: "", endereco: "" })));
  const [threshold, setThreshold] = useState<number | null>(null);
  const [mostrarComparativo, setMostrarComparativo] = useState(false);
  const [confirmacao, setConfirmacao] = useState<null | "assinado" | "concluida">(null);

  const eu = wallet.publicKey?.toBase58() ?? null;
  const membros = info?.membros.map((m) => m.key.toBase58()) ?? [];
  const signatarios = cofre?.signatarios ?? [];
  const gestoes = cofre?.gestoes ?? [];
  const executadas = propostas.filter((p) => p.status === "Executed").length;

  // Transição pendente = proposta de config aberta/aprovada mais recente.
  const transicaoChain = useMemo(() => {
    if (!info) return null;
    const cfg = propostas.find((p) => p.tipo === "config" && (p.status === "Active" || p.status === "Approved") && !p.obsoleta);
    return cfg ? mapearProposta(cfg, info.threshold, cofre) : null;
  }, [propostas, info, cofre]);
  const transicaoLocal = cofre?.transicao ?? null;

  const preenchidas = linhas.filter((l) => l.endereco.trim());
  const invalidas = preenchidas.filter((l) => !pubkeyValida(l.endereco));
  const duplicadas = new Set(preenchidas.map((l) => l.endereco.trim())).size !== preenchidas.length;
  const thresholdEfetivo = threshold ?? info?.threshold ?? 3;
  const formValido =
    nomeNova.trim().length >= 2 && preenchidas.length >= 1 && invalidas.length === 0 && !duplicadas && thresholdEfetivo >= 1 && thresholdEfetivo <= preenchidas.length;

  function abrirForm() {
    setNomeNova("");
    setLinhas(ASSENTOS.map(() => ({ nome: "", endereco: "" })));
    setThreshold(info?.threshold ?? 3);
    setModo("form");
  }

  function editar(i: number, campo: keyof Linha, valor: string) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  async function propor(e: React.FormEvent) {
    e.preventDefault();
    if (!formValido || !info) return;
    const novos = preenchidas.map((l) => l.endereco.trim());
    const adicionar = novos.filter((k) => !membros.includes(k)).map((k) => new PublicKey(k));
    const remover = membros.filter((k) => !novos.includes(k)).map((k) => new PublicKey(k));
    const r = await rodar("propor", () =>
      proporTrocaDeSignatarios({
        connection,
        assinador: assinadorWallet(wallet),
        multisigPda: info.multisigPda,
        adicionar,
        remover,
        novoThreshold: thresholdEfetivo,
        memo: `LigaFi transição: ${nomeNova.trim()}`,
      }),
    );
    if (!r) return;
    const novosLocais: SignatarioLocal[] = preenchidas.map((l, i) => ({
      endereco: l.endereco.trim(),
      nome: l.nome.trim() || `Signatário ${i + 1}`,
      cargo: PAPEL_LABEL[ASSENTOS[Math.min(i, 4)]],
    }));
    for (const s of novosLocais) renomearSignatario(s.endereco, s.nome, s.cargo);
    anotarProposta(r.transactionIndex, { descricao: `Transição para ${nomeNova.trim()}`, categoria: "outros" });
    atualizarCofre({
      transicao: {
        indice: r.transactionIndex.toString(),
        nomeNovaGestao: nomeNova.trim(),
        novos: novosLocais,
        snapshot: {
          antes: { endereco: info.multisigPda.toBase58(), saldoLamports: info.saldoVaultLamports, propostas: Number(info.transactionIndex), signatarios: membros },
          depois: { endereco: "", saldoLamports: 0, propostas: 0, signatarios: [] },
        },
      },
    });
    setModo("lista");
    await recarregar();
  }

  async function assinar() {
    if (!info || !transicaoChain) return;
    const sig = await rodar("assinar", () =>
      aprovarProposta({ connection, assinador: assinadorWallet(wallet), multisigPda: info.multisigPda, transactionIndex: transicaoChain.indice }),
    );
    if (!sig) return;
    await recarregar();
    setConfirmacao("assinado");
  }

  async function executar() {
    if (!info || !transicaoChain) return;
    const sig = await rodar("executar", () =>
      executarProposta({ connection, assinador: assinadorWallet(wallet), multisigPda: info.multisigPda, transactionIndex: transicaoChain.indice }),
    );
    if (!sig) return;
    const depoisInfo = await lerMultisig(connection, info.multisigPda);
    const t: TransicaoLocal = transicaoLocal?.indice === transicaoChain.id
      ? transicaoLocal
      : { indice: transicaoChain.id, nomeNovaGestao: transicaoChain.descricao, novos: [] };
    const concluida: TransicaoLocal = {
      ...t,
      concluidaEm: agoraISO(),
      snapshot: {
        antes: t.snapshot?.antes ?? { endereco: info.multisigPda.toBase58(), saldoLamports: info.saldoVaultLamports, propostas: Number(info.transactionIndex), signatarios: membros },
        depois: {
          endereco: depoisInfo.multisigPda.toBase58(),
          saldoLamports: depoisInfo.saldoVaultLamports,
          propostas: Number(depoisInfo.transactionIndex),
          signatarios: depoisInfo.membros.map((m) => m.key.toBase58()),
        },
      },
    };
    const hoje = agoraISO().slice(0, 10);
    const anteriores = gestoes.length ? gestoes : [{ nome: "Gestão fundadora", inicio: cofre?.criadoEm.slice(0, 10) ?? hoje, signatarios: membros }];
    atualizarCofre({
      transicao: null,
      ultimaTransicao: concluida,
      gestoes: [
        ...anteriores.map((g, i) => (i === anteriores.length - 1 ? { ...g, fim: hoje } : g)),
        { nome: t.nomeNovaGestao, inicio: hoje, signatarios: concluida.snapshot!.depois.signatarios, indiceTransicao: t.indice },
      ],
    });
    anotarProposta(transicaoChain.indice, { descricao: `Transição para ${t.nomeNovaGestao}`, categoria: "outros", execucaoSig: sig });
    await recarregar();
    setMostrarComparativo(true);
    setConfirmacao("concluida");
  }

  const jaAssinei = !!eu && !!transicaoChain && transicaoChain.aprovacoes.includes(eu);
  const souMembro = !!eu && membros.includes(eu);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-end">
        <Link href="/painel" className="text-xs font-medium text-white/60 hover:text-white">
          ← Painel
        </Link>
      </div>

      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Rotulo>Gestão atual</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">
            {gestoes.length ? gestoes[gestoes.length - 1].nome : cofre?.nomeEntidade ?? "Entidade"}
          </h1>
          <p className="text-sm text-white/60">
            {info ? `${info.membros.length} signatários · quórum ${info.threshold} de ${info.membros.length}` : "lendo a devnet…"}
          </p>
        </div>
        <BadgeRede className="mt-1" />
      </header>

      {/* Selo */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-palha/30 bg-palha/[0.06] px-4 py-3 animate-fadeUp">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-palha text-lg" aria-hidden>
          🛡️
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-palha">
            <span className="tabular">{executadas}</span> movimento{executadas !== 1 ? "s" : ""} e{" "}
            <span className="tabular">{Math.max(1, gestoes.length)}</span> gest{gestoes.length > 1 ? "ões" : "ão"} preservados
          </p>
          <p className="text-xs text-white/60">
            {info?.governancaOnChain ? "config_authority = null · governança 100% on-chain" : "lendo…"}
            {info && (
              <>
                {" · "}
                <a href={solscanConta(info.multisigPda.toBase58())} target="_blank" rel="noopener noreferrer" className="tabular hover:text-white">
                  {truncarEndereco(info.multisigPda.toBase58(), 5)} ↗
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <Mensagens erro={erro} aviso={aviso} />

      {mostrarComparativo && cofre?.ultimaTransicao?.snapshot && (
        <Comparativo transicao={cofre.ultimaTransicao} onFechar={() => setMostrarComparativo(false)} />
      )}

      {/* Diretoria atual */}
      <section className="mb-5">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <Rotulo>Signatários na chain</Rotulo>
          <span className="text-xs text-white/40">nomes ficam neste navegador</span>
        </div>
        <Card>
          {info ? (
            <ul className="flex flex-col gap-2.5">
              {membros.map((m) => (
                <LinhaSignatario key={m} endereco={m} destaque={m === eu ? "você" : undefined} direita={<code className="tabular text-[10px] text-white/40">{truncarEndereco(m)}</code>} />
              ))}
            </ul>
          ) : (
            <div className="h-24 animate-pulse rounded bg-white/5" />
          )}
        </Card>
      </section>

      {/* Transição pendente (na chain) */}
      {transicaoChain && info && (
        <section className="mb-5 animate-fadeUp">
          <div className="mb-2 px-1">
            <Rotulo>Transição em andamento · proposta #{transicaoChain.id}</Rotulo>
          </div>
          <Card className="border-palha/40">
            <p className="text-sm text-white/60">Nova gestão proposta</p>
            <p className="font-display text-lg font-semibold">{transicaoLocal?.nomeNovaGestao ?? transicaoChain.descricao}</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm">
              {(transicaoChain.acoes ?? []).map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={`w-10 text-[10px] font-semibold uppercase ${a.tipo === "AddMember" ? "text-entrada" : a.tipo === "RemoveMember" ? "text-saida" : "text-palha"}`}>
                    {a.tipo === "AddMember" ? "entra" : a.tipo === "RemoveMember" ? "sai" : "thr"}
                  </span>
                  {a.chave ? (
                    <span className="min-w-0 truncate">
                      {signatarios.find((s) => s.endereco === a.chave!.toBase58())?.nome ?? truncarEndereco(a.chave.toBase58(), 6)}
                    </span>
                  ) : (
                    <span>→ {a.valor}</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="flex items-center justify-between">
                <Rotulo>Assinaturas da gestão atual</Rotulo>
                <span className="tabular text-sm font-semibold">
                  {transicaoChain.aprovacoes.length} de {transicaoChain.necessarias}
                </span>
              </div>
              <div className="mt-2">
                <SlotsQuorumEnderecos assinaturas={transicaoChain.aprovacoes} necessarias={transicaoChain.necessarias} tamanho="lg" />
              </div>
            </div>

            {transicaoChain.status === "aprovada" ? (
              <Botao className="mt-4 w-full" onClick={executar} disabled={!souMembro || !!ocupado}>
                {ocupado === "executar" ? "Executando na devnet…" : "Executar a troca de gestão"}
              </Botao>
            ) : (
              <Botao className="mt-4 w-full" onClick={assinar} disabled={!souMembro || jaAssinei || !!ocupado}>
                {ocupado === "assinar" ? "Assinando…" : jaAssinei ? "Você já assinou" : transicaoChain.necessarias - transicaoChain.aprovacoes.length === 1 ? "Assinar e atingir o quórum" : "Assinar transição"}
              </Botao>
            )}
            <p className="mt-2 text-center text-[11px] text-white/40">
              A troca só acontece com {info.threshold} assinaturas da gestão atual. O cofre continua o mesmo.
            </p>
          </Card>
        </section>
      )}

      {/* Formulário */}
      {!transicaoChain && modo === "form" && info && (
        <form onSubmit={propor} className="mb-5 flex flex-col gap-3 animate-fadeUp">
          <Card className="flex flex-col gap-4">
            <Rotulo>Nova gestão</Rotulo>
            <input
              type="text"
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
              placeholder="Gestão 2026–27"
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
            <div className="flex items-baseline justify-between">
              <Rotulo>Novos signatários</Rotulo>
              <button
                type="button"
                onClick={() => setLinhas(ASSENTOS.map((_, i) => ({ nome: signatarios.find((s) => s.endereco === membros[i])?.nome ?? "", endereco: membros[i] ?? "" })))}
                className="text-xs text-palha hover:underline"
              >
                começar dos atuais
              </button>
            </div>
            <ol className="flex flex-col gap-3">
              {linhas.map((l, i) => {
                const ruim = l.endereco.trim() && !pubkeyValida(l.endereco);
                const atual = membros.includes(l.endereco.trim());
                return (
                  <li key={i} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.08] p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white/80">
                        {l.nome.trim() ? iniciaisDe(l.nome) : i + 1}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{PAPEL_LABEL[ASSENTOS[i]]}</span>
                      {l.endereco.trim() && (
                        <span className={`ml-auto text-[10px] font-semibold uppercase ${atual ? "text-white/40" : "text-entrada"}`}>{atual ? "permanece" : "novo"}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={l.nome}
                      onChange={(e) => editar(i, "nome", e.target.value)}
                      placeholder="Nome"
                      className="rounded-lg border border-white/10 bg-mata px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-palha"
                    />
                    <input
                      type="text"
                      value={l.endereco}
                      onChange={(e) => editar(i, "endereco", e.target.value)}
                      placeholder="Endereço da carteira"
                      spellCheck={false}
                      className={`tabular rounded-lg border bg-mata px-3 py-2 font-mono text-xs outline-none placeholder:text-white/30 focus:border-palha ${ruim ? "border-saida/60" : "border-white/10"}`}
                    />
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <div>
                <Rotulo>Threshold</Rotulo>
                <p className="text-[11px] text-white/45">da nova gestão</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setThreshold(Math.max(1, thresholdEfetivo - 1))} className="grid h-8 w-8 place-items-center rounded-full border border-white/15 hover:border-white/40">−</button>
                <span className="tabular w-16 text-center font-display text-lg font-semibold">
                  {thresholdEfetivo} de {preenchidas.length || "—"}
                </span>
                <button type="button" onClick={() => setThreshold(Math.min(Math.max(1, preenchidas.length), thresholdEfetivo + 1))} className="grid h-8 w-8 place-items-center rounded-full border border-white/15 hover:border-white/40">+</button>
              </div>
            </div>
            {duplicadas && <p className="text-xs text-saida">Há endereços repetidos.</p>}
          </Card>
          <Botao type="submit" disabled={!formValido || !!ocupado}>
            {ocupado === "propor" ? "Enviando para a devnet…" : "Propor transição (já assina)"}
          </Botao>
          <button type="button" onClick={() => setModo("lista")} className="py-1 text-sm text-white/60 hover:text-white">
            Cancelar
          </button>
        </form>
      )}

      {!transicaoChain && modo === "lista" && (
        <div className="mb-5 flex flex-col gap-2">
          <Botao onClick={abrirForm} disabled={!info || !souMembro}>
            Iniciar transição de gestão
          </Botao>
          {cofre?.ultimaTransicao?.snapshot && !mostrarComparativo && (
            <button type="button" onClick={() => setMostrarComparativo(true)} className="py-1 text-sm text-palha hover:underline">
              Ver comparativo da última transição
            </button>
          )}
        </div>
      )}

      {/* Histórico */}
      <section className="mt-auto">
        <Rotulo className="mb-2 px-1">Histórico de gestões</Rotulo>
        <Card className="divide-y divide-white/[0.06] p-0">
          {(gestoes.length ? [...gestoes].reverse() : [{ nome: cofre?.nomeEntidade ?? "Gestão atual", inicio: cofre?.criadoEm.slice(0, 10) ?? "", signatarios: membros }]).map((g, i) => (
            <div key={`${g.nome}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  {g.nome}
                  {!("fim" in g && g.fim) && <span className="ml-2 text-[10px] font-semibold uppercase text-entrada">atual</span>}
                </p>
                <p className="text-xs text-white/50">
                  {g.inicio}
                  {"fim" in g && g.fim ? ` – ${g.fim}` : " – atual"} · {g.signatarios.length} signatários
                </p>
              </div>
              {"indiceTransicao" in g && g.indiceTransicao && (
                <Link href={`/pagamento/${g.indiceTransicao}`} className="tabular text-xs text-palha hover:underline">
                  #{g.indiceTransicao}
                </Link>
              )}
            </div>
          ))}
        </Card>
        {info && (
          <p className="mt-3 text-center text-[11px] text-white/40">
            Saldo atual {formatSol(lamportsParaSol(info.saldoVaultLamports))} (≈ {formatBRL(lamportsParaSol(info.saldoVaultLamports) * BRL_POR_SOL)}) · herdado integralmente a cada troca.
          </p>
        )}
      </section>

      {confirmacao && (
        <ConfirmacaoOverlay
          titulo={confirmacao === "concluida" ? "Gestão transferida" : "Assinatura registrada"}
          texto={confirmacao === "concluida" ? "Mesmo cofre, mesmo saldo, mesmo histórico. Só mudaram os signatários." : "Registrada na devnet."}
          tom={confirmacao === "concluida" ? "entrada" : "palha"}
          duracaoMs={confirmacao === "concluida" ? 2600 : 1500}
          onFim={() => setConfirmacao(null)}
        />
      )}
    </main>
  );
}

function Comparativo({ transicao, onFechar }: { transicao: TransicaoLocal; onFechar: () => void }) {
  const s = transicao.snapshot!;
  const iguais = s.antes.endereco === s.depois.endereco;
  const linhas = [
    { rotulo: "Endereço do cofre", antes: truncarEndereco(s.antes.endereco, 6), depois: truncarEndereco(s.depois.endereco, 6), ok: iguais },
    { rotulo: "Saldo", antes: formatSol(lamportsParaSol(s.antes.saldoLamports)), depois: formatSol(lamportsParaSol(s.depois.saldoLamports)), ok: s.antes.saldoLamports === s.depois.saldoLamports },
    { rotulo: "Histórico", antes: `${s.antes.propostas} propostas`, depois: `${s.depois.propostas} propostas`, ok: s.depois.propostas >= s.antes.propostas },
  ];
  return (
    <section className="mb-5 animate-fadeUp">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <Rotulo>Antes → depois da transição</Rotulo>
        <button type="button" onClick={onFechar} className="text-xs text-white/40 hover:text-white">
          fechar
        </button>
      </div>
      <Card className="border-entrada/40">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Antes</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.antes.signatarios.map((k) => (
                <LinhaSignatario key={k} endereco={k} tom="neutro" />
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-entrada">Depois</p>
            <p className="truncate text-sm font-semibold">{transicao.nomeNovaGestao}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {s.depois.signatarios.map((k) => (
                <LinhaSignatario key={k} endereco={k} />
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">O que permaneceu idêntico</p>
          <table className="w-full text-xs">
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rotulo} className="border-b border-white/[0.06] last:border-0">
                  <th scope="row" className="py-2 pr-2 text-left font-medium text-white/70">{l.rotulo}</th>
                  <td className="tabular py-2 pr-2 text-white/60">{l.antes}</td>
                  <td className="tabular py-2 pr-2 text-white">{l.depois}</td>
                  <td className="py-2 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${l.ok ? "bg-entrada/15 text-entrada" : "bg-saida/15 text-saida"}`}>
                      {l.ok ? "✓ idêntico" : "diferente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-white/50">
            Concluída em {transicao.concluidaEm ? formatDataHora(transicao.concluidaEm) : "—"}. Lido da devnet antes e depois da execução. Nada foi transferido: a entidade continua dona do cofre.
          </p>
        </div>
      </Card>
    </section>
  );
}
