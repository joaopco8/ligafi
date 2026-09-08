"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LinhaDiretor, SlotsQuorum } from "@/components/assinaturas";
import { ConfirmacaoOverlay } from "@/components/confirmacao";
import { Botao, Card, Rotulo } from "@/components/ui";
import { formatBRL, formatDataHora, formatMesAno, formatPeriodo, iniciaisDe, mesesEntre, hojeISO } from "@/lib/format";
import { calcularSaldo, enderecoFicticio, idsDe, liga } from "@/lib/mock-data";
import { ASSENTOS, PAPEL_LABEL } from "@/lib/regras";
import { useDiretoresAtuais, useGestaoAtual, useLigaFi, type NovoSignatario } from "@/lib/store";
import { truncarHash } from "@/lib/tx";
import type { Diretor, Transicao } from "@/lib/types";

const EXEMPLO = ["Marina Duarte", "Felipe Cardoso", "Bianca Lopes", "Gustavo Ramos", "Carolina Nunes"];

function proximoNome(nomeAtual: string): string {
  const m = nomeAtual.match(/(\d{4})–(\d{2})/);
  if (!m) return "Nova gestão";
  const ano = Number(m[1]) + 1;
  return `Gestão ${ano}–${String(ano + 1).slice(2)}`;
}

function linhasVazias(): NovoSignatario[] {
  return ASSENTOS.map(() => ({ nome: "", endereco: "" }));
}

export default function GestaoPage() {
  const gestoes = useLigaFi((s) => s.gestoes);
  const movimentos = useLigaFi((s) => s.movimentos);
  const transicao = useLigaFi((s) => s.transicao);
  const ultimaTransicao = useLigaFi((s) => s.ultimaTransicao);
  const diretorAtual = useLigaFi((s) => s.diretorAtual);
  const setDiretorAtual = useLigaFi((s) => s.setDiretorAtual);
  const iniciarTransicao = useLigaFi((s) => s.iniciarTransicao);
  const assinarTransicao = useLigaFi((s) => s.assinarTransicao);
  const cancelarTransicao = useLigaFi((s) => s.cancelarTransicao);
  const gestaoAtual = useGestaoAtual();
  const diretoresAtuais = useDiretoresAtuais();

  const [modo, setModo] = useState<"lista" | "form">("lista");
  const [nomeNova, setNomeNova] = useState("");
  const [linhas, setLinhas] = useState<NovoSignatario[]>(linhasVazias);
  const [mostrarComparativo, setMostrarComparativo] = useState(false);
  const [confirmacao, setConfirmacao] = useState<null | "assinado" | "concluida">(null);

  const { necessarias } = liga.quorumGovernanca;
  const saldo = calcularSaldo(movimentos);
  const formValido = linhas.every((l) => l.nome.trim().length >= 3 && l.endereco.trim().length >= 32);

  const assinaramIds = idsDe(transicao?.assinaturas ?? []);
  const podeAssinar =
    !!transicao && gestaoAtual.diretores.includes(diretorAtual) && !assinaramIds.includes(diretorAtual);
  const faltam = transicao ? Math.max(0, necessarias - assinaramIds.length) : 0;

  const gestaoAnterior = useMemo(
    () => gestoes.find((g) => g.id === ultimaTransicao?.gestaoAnteriorId),
    [gestoes, ultimaTransicao],
  );

  const mesesMandato = mesesEntre(gestaoAtual.inicio, gestaoAtual.fim ?? hojeISO());

  function abrirForm() {
    setNomeNova(proximoNome(gestaoAtual.nome));
    setLinhas(linhasVazias());
    setModo("form");
  }

  function preencherExemplo() {
    setLinhas(EXEMPLO.map((nome) => ({ nome, endereco: enderecoFicticio(nome) })));
  }

  function editar(i: number, campo: keyof NovoSignatario, valor: string) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!formValido) return;
    iniciarTransicao(nomeNova, linhas);
    setModo("lista");
    if (!gestaoAtual.diretores.includes(diretorAtual)) setDiretorAtual(gestaoAtual.diretores[0]);
  }

  function assinar() {
    const status = assinarTransicao(diretorAtual);
    if (status === "concluida") {
      setConfirmacao("concluida");
      setMostrarComparativo(true);
    } else if (status === "pendente") {
      setConfirmacao("assinado");
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-end">
        <Link href="/painel" className="text-xs font-medium text-white/60 hover:text-white">
          ← Painel
        </Link>
      </div>

      <header className="mb-4">
        <Rotulo>Gestão atual</Rotulo>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">{gestaoAtual.nome}</h1>
        <p className="text-sm text-white/60">
          {liga.sigla} · mandato {formatPeriodo(gestaoAtual.inicio, gestaoAtual.fim)}
          {mesesMandato > 0 && <span className="tabular"> · {mesesMandato} meses</span>}
        </p>
      </header>

      {/* Selo */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-palha/30 bg-palha/[0.06] px-4 py-3 animate-fadeUp">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-palha text-lg" aria-hidden>
          🛡️
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-palha">
            <span className="tabular">{movimentos.length}</span> movimentos e{" "}
            <span className="tabular">{gestoes.length}</span> gestões preservados
          </p>
          <p className="text-xs text-white/60">
            Mesmo cofre desde {formatMesAno(liga.fundadaEm)} ·{" "}
            <span className="tabular">{truncarHash(liga.enderecoCofre, 5)}</span>
          </p>
        </div>
      </div>

      {/* Comparativo antes/depois */}
      {mostrarComparativo && ultimaTransicao?.status === "concluida" && (
        <Comparativo
          transicao={ultimaTransicao}
          nomeAnterior={gestaoAnterior?.nome ?? "Gestão anterior"}
          diretoresAnteriores={gestaoAnterior?.diretores ?? []}
          totalMovimentos={movimentos.length}
          totalGestoes={gestoes.length}
          onFechar={() => setMostrarComparativo(false)}
        />
      )}

      {/* Diretoria atual */}
      <section className="mb-5">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <Rotulo>Diretoria · {diretoresAtuais.length} signatários</Rotulo>
          <span className="text-xs text-white/40">
            governança {necessarias} de {liga.quorumGovernanca.total}
          </span>
        </div>
        <Card>
          <ul className="flex flex-col gap-2.5">
            {diretoresAtuais.map((d) => (
              <LinhaDiretor
                key={d.id}
                diretor={d.id}
                direita={<code className="tabular text-[10px] text-white/40">{truncarHash(d.endereco, 4)}</code>}
              />
            ))}
          </ul>
        </Card>
      </section>

      {/* Transição pendente */}
      {transicao && (
        <section className="mb-5 animate-fadeUp">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <Rotulo>Transição em andamento</Rotulo>
            <button type="button" onClick={cancelarTransicao} className="text-xs text-white/40 hover:text-saida">
              cancelar
            </button>
          </div>
          <Card className="border-palha/40">
            <p className="text-sm text-white/60">Nova gestão proposta</p>
            <p className="font-display text-lg font-semibold">{transicao.nomeNovaGestao}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {transicao.novosDiretores.map((d) => (
                <LinhaNovoDiretor key={d.id} diretor={d} />
              ))}
            </ul>

            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="flex items-center justify-between">
                <Rotulo>Assinaturas da gestão atual</Rotulo>
                <span className="tabular text-sm font-semibold">
                  {assinaramIds.length} de {necessarias}
                </span>
              </div>
              <div className="mt-2">
                <SlotsQuorum assinaturas={assinaramIds} necessarias={necessarias} tamanho="lg" />
              </div>
              {transicao.assinaturas.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {transicao.assinaturas.map((a) => (
                    <LinhaDiretor
                      key={a.diretor}
                      diretor={a.diretor}
                      direita={<span className="tabular text-xs text-white/50">{formatDataHora(a.em)}</span>}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <Rotulo>Assinar como</Rotulo>
              <div className="mt-2 flex flex-wrap gap-2">
                {diretoresAtuais.map((d) => {
                  const assinou = assinaramIds.includes(d.id);
                  const ativo = d.id === diretorAtual;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={assinou}
                      onClick={() => setDiretorAtual(d.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                        ativo ? "border-palha bg-palha text-mata" : "border-white/15 text-white/80 hover:border-white/40"
                      }`}
                    >
                      {d.iniciais} · {d.nome.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <Botao className="mt-4 w-full" onClick={assinar} disabled={!podeAssinar}>
              {!podeAssinar ? "Você já assinou" : faltam === 1 ? "Assinar e efetivar a troca" : "Assinar transição"}
            </Botao>
            <p className="mt-2 text-center text-[11px] text-white/40">
              A troca só acontece com {necessarias} assinaturas da gestão atual. O cofre continua o mesmo.
            </p>
          </Card>
        </section>
      )}

      {/* Formulário de transição */}
      {!transicao && modo === "form" && (
        <form onSubmit={submeter} className="mb-5 flex flex-col gap-3 animate-fadeUp">
          <Card className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <Rotulo>Nova gestão</Rotulo>
              <button type="button" onClick={preencherExemplo} className="text-xs text-palha hover:underline">
                preencher com exemplo
              </button>
            </div>
            <input
              type="text"
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
              placeholder="Gestão 2026–27"
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
            <Rotulo>5 novos signatários</Rotulo>
            <ol className="flex flex-col gap-3">
              {linhas.map((l, i) => (
                <li key={i} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.08] p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-medium text-white/80">
                      {l.nome.trim() ? iniciaisDe(l.nome) : i + 1}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      {PAPEL_LABEL[ASSENTOS[i]]}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={l.nome}
                    onChange={(e) => editar(i, "nome", e.target.value)}
                    placeholder="Nome completo"
                    className="rounded-lg border border-white/10 bg-mata px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-palha"
                  />
                  <input
                    type="text"
                    value={l.endereco}
                    onChange={(e) => editar(i, "endereco", e.target.value)}
                    placeholder="Endereço da carteira (base58)"
                    spellCheck={false}
                    className="tabular rounded-lg border border-white/10 bg-mata px-3 py-2 font-mono text-xs outline-none placeholder:text-white/30 focus:border-palha"
                  />
                </li>
              ))}
            </ol>
          </Card>
          <Botao type="submit" disabled={!formValido}>
            Propor transição
          </Botao>
          <button type="button" onClick={() => setModo("lista")} className="py-1 text-sm text-white/60 hover:text-white">
            Cancelar
          </button>
        </form>
      )}

      {!transicao && modo === "lista" && (
        <div className="mb-5 flex flex-col gap-2">
          <Botao onClick={abrirForm}>Iniciar transição de gestão</Botao>
          {ultimaTransicao && !mostrarComparativo && (
            <button
              type="button"
              onClick={() => setMostrarComparativo(true)}
              className="py-1 text-sm text-palha hover:underline"
            >
              Ver comparativo da última transição
            </button>
          )}
        </div>
      )}

      {/* Histórico de gestões */}
      <section className="mt-auto">
        <Rotulo className="mb-2 px-1">Histórico de gestões</Rotulo>
        <Card className="divide-y divide-white/[0.06] p-0">
          {[...gestoes].reverse().map((g) => {
            const n = movimentos.filter((m) => m.gestaoId === g.id).length;
            return (
              <div key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    {g.nome}
                    {!g.fim && <span className="ml-2 text-[10px] font-semibold uppercase text-entrada">atual</span>}
                  </p>
                  <p className="text-xs text-white/50">{formatPeriodo(g.inicio, g.fim)}</p>
                </div>
                <span className="tabular text-xs text-white/50">{n} mov.</span>
              </div>
            );
          })}
        </Card>
        <p className="mt-3 text-center text-[11px] text-white/40">
          Saldo atual {formatBRL(saldo)} · herdado integralmente a cada troca.
        </p>
      </section>

      {confirmacao && (
        <ConfirmacaoOverlay
          titulo={confirmacao === "concluida" ? "Gestão transferida" : "Assinatura registrada"}
          texto={
            confirmacao === "concluida"
              ? "Mesmo cofre, mesmo saldo, mesmo histórico. Só mudaram os signatários."
              : `${assinaramIds.length} de ${necessarias} assinaturas.`
          }
          tom={confirmacao === "concluida" ? "entrada" : "palha"}
          duracaoMs={confirmacao === "concluida" ? 2600 : 1500}
          onFim={() => setConfirmacao(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function LinhaNovoDiretor({ diretor }: { diretor: Diretor }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-medium ring-2 ring-mata-card">
        {diretor.iniciais}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {diretor.nome} <span className="text-white/40">· {diretor.cargo}</span>
      </span>
      <code className="tabular text-[10px] text-white/40">{truncarHash(diretor.endereco, 4)}</code>
    </li>
  );
}

function Comparativo({
  transicao,
  nomeAnterior,
  diretoresAnteriores,
  totalMovimentos,
  totalGestoes,
  onFechar,
}: {
  transicao: Transicao;
  nomeAnterior: string;
  diretoresAnteriores: string[];
  totalMovimentos: number;
  totalGestoes: number;
  onFechar: () => void;
}) {
  const s = transicao.snapshot;
  const linhas = s
    ? [
        { rotulo: "Endereço do cofre", antes: truncarHash(s.antes.endereco, 6), depois: truncarHash(s.depois.endereco, 6) },
        { rotulo: "Saldo", antes: formatBRL(s.antes.saldo), depois: formatBRL(s.depois.saldo) },
        { rotulo: "Histórico", antes: `${s.antes.movimentos} movimentos`, depois: `${s.depois.movimentos} movimentos` },
      ]
    : [];

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
            <p className="truncate text-sm font-semibold">{nomeAnterior}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {diretoresAnteriores.map((id) => (
                <LinhaDiretor key={id} diretor={id} tom="neutro" />
              ))}
            </ul>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-entrada">Depois</p>
            <p className="truncate text-sm font-semibold">{transicao.nomeNovaGestao}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {transicao.novosDiretores.map((d) => (
                <LinhaDiretor key={d.id} diretor={d.id} />
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
                  <th scope="row" className="py-2 pr-2 text-left font-medium text-white/70">
                    {l.rotulo}
                  </th>
                  <td className="tabular py-2 pr-2 text-white/60">{l.antes}</td>
                  <td className="tabular py-2 pr-2 text-white">{l.depois}</td>
                  <td className="py-2 text-right">
                    <span className="rounded-full bg-entrada/15 px-2 py-0.5 text-[10px] font-semibold text-entrada">
                      ✓ idêntico
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-palha/40 bg-palha/10 px-3 py-1 text-[11px] font-semibold text-palha">
            🛡️ <span className="tabular">{totalMovimentos}</span> movimentos e <span className="tabular">{totalGestoes}</span>{" "}
            gestões preservados
          </div>
          <p className="mt-3 text-[11px] text-white/50">
            Concluída em {transicao.concluidaEm ? formatDataHora(transicao.concluidaEm) : "—"} com{" "}
            {transicao.assinaturas.length} assinaturas da gestão anterior. Nada foi transferido: a entidade
            continua dona do cofre.
          </p>
        </div>
      </Card>
    </section>
  );
}
