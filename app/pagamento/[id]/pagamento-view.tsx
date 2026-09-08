"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LinhaDiretor, SlotsQuorum } from "@/components/assinaturas";
import { ConfirmacaoOverlay } from "@/components/confirmacao";
import { BadgeCategoria } from "@/components/resumo-extrato";
import { Botao, BotaoLink, Card, Rotulo, Topo } from "@/components/ui";
import { formatBRL, formatData, formatDataHora } from "@/lib/format";
import { idsDe, liga } from "@/lib/mock-data";
import { TOTAL_SIGNATARIOS, quorumAtingido, quorumPara, temConselho } from "@/lib/regras";
import { useDiretoresAtuais, useGestaoAtual, useLigaFi } from "@/lib/store";
import { solscanUrl, truncarHash } from "@/lib/tx";

export function PagamentoView({ id }: { id: string }) {
  const pagamento = useLigaFi((s) => s.pagamentos.find((p) => p.id === id));
  const diretores = useLigaFi((s) => s.diretores);
  const diretorAtual = useLigaFi((s) => s.diretorAtual);
  const setDiretorAtual = useLigaFi((s) => s.setDiretorAtual);
  const assinar = useLigaFi((s) => s.assinar);
  const gestaoAtual = useGestaoAtual();
  const diretoresAtuais = useDiretoresAtuais();

  const [confirmacao, setConfirmacao] = useState<null | "assinado" | "executado">(null);

  const jaAssinaram = idsDe(pagamento?.assinaturas ?? []);
  const disponiveis = diretoresAtuais.filter((d) => !jaAssinaram.includes(d.id));

  // Garante que o assinante selecionado é da gestão atual e ainda não assinou.
  useEffect(() => {
    if (!pagamento) return;
    const valido = gestaoAtual.diretores.includes(diretorAtual) && !jaAssinaram.includes(diretorAtual);
    if (!valido && disponiveis[0]) setDiretorAtual(disponiveis[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagamento?.assinaturas.length, gestaoAtual.id]);

  if (!pagamento) {
    return (
      <main className="flex flex-1 flex-col">
        <Topo voltar={{ href: "/painel", label: "Painel" }} titulo="Pagamento não encontrado" />
        <Card className="text-sm text-white/60">Esse pagamento não existe nesta demo.</Card>
      </main>
    );
  }

  const q = quorumPara(pagamento.valor);
  const executado = pagamento.status === "executado";
  const resgate = pagamento.natureza === "resgate";
  const n = jaAssinaram.length;
  const faltam = Math.max(0, q.necessarias - n);
  const conselhoAssinou = temConselho(pagamento.assinaturas, diretores);
  const faltaConselho = q.exigeConselho && !conselhoAssinou;
  const podeAssinar = !executado && gestaoAtual.diretores.includes(diretorAtual) && !jaAssinaram.includes(diretorAtual);
  const completaria =
    podeAssinar && quorumAtingido(pagamento.valor, [...pagamento.assinaturas, { diretor: diretorAtual, em: "" }], diretores);

  function handleAssinar() {
    const status = assinar(pagamento!.id, diretorAtual);
    if (status) setConfirmacao(status === "executado" ? "executado" : "assinado");
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <Topo
        voltar={{ href: "/painel", label: "Painel" }}
        titulo={pagamento.descricao}
        sub={`Proposto em ${formatData(pagamento.criadoEm)} · para ${pagamento.destinatario}`}
      />

      <Card className="mb-4 animate-fadeUp">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Rotulo>Valor</Rotulo>
            <p className={`tabular mt-0.5 font-display text-3xl font-semibold tracking-[-0.02em] ${resgate ? "text-entrada" : "text-saida"}`}>
              {resgate ? "↺" : "−"} {formatBRL(pagamento.valor)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                executado ? "bg-entrada/15 text-entrada" : "bg-palha/15 text-palha"
              }`}
            >
              {executado ? (resgate ? "Resgatado" : "Executado") : "Pendente"}
            </span>
            {resgate ? (
              <span className="rounded-full border border-entrada/40 px-2 py-0.5 text-[10px] font-semibold text-entrada">
                Resgate da aplicação
              </span>
            ) : (
              <BadgeCategoria categoria={pagamento.categoria} />
            )}
          </div>
        </div>
        {pagamento.detalhe && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-relaxed text-white/70">{pagamento.detalhe}</p>
        )}
        <ul className="mt-3 border-t border-white/[0.06] pt-3">
          <LinhaDiretor
            diretor={pagamento.propostoPor}
            tom="neutro"
            direita={<span className="text-[10px] font-semibold uppercase text-white/40">propôs</span>}
          />
        </ul>
      </Card>

      <Card className="mb-4 animate-fadeUp" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between">
          <Rotulo>Assinaturas</Rotulo>
          <span className="tabular text-sm font-semibold">
            {Math.min(n, q.necessarias)} de {q.necessarias}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-white/50">
          Faixa {q.faixa.label}: {q.necessarias} assinaturas
          {q.exigeConselho && ", incluindo o conselho fiscal"}.{" "}
          <Link href="/regras" className="text-palha hover:underline">
            ver regras
          </Link>
        </p>
        <div className="mt-3">
          <SlotsQuorum assinaturas={jaAssinaram} necessarias={q.necessarias} tamanho="lg" />
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {pagamento.assinaturas.map((a) => (
            <LinhaDiretor
              key={a.diretor}
              diretor={a.diretor}
              direita={
                <span className="flex items-center gap-2 text-xs">
                  <span className="tabular text-white/50">{formatDataHora(a.em)}</span>
                  <span className="text-entrada" aria-label="assinou">
                    ✓
                  </span>
                </span>
              }
            />
          ))}
          {!executado && faltam > 0 && (
            <li className="text-xs text-white/50">
              Falta{faltam > 1 ? "m" : ""} {faltam} assinatura{faltam > 1 ? "s" : ""} de {TOTAL_SIGNATARIOS - n} diretor
              {TOTAL_SIGNATARIOS - n > 1 ? "es" : ""} restante{TOTAL_SIGNATARIOS - n > 1 ? "s" : ""}.
            </li>
          )}
          {!executado && faltaConselho && (
            <li className="text-xs font-medium text-palha">Assinatura do conselho fiscal é obrigatória nesta faixa.</li>
          )}
        </ul>
        {executado && pagamento.executadoEm && (
          <div className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/60">
            <p>
              {resgate
                ? `Resgatado em ${formatData(pagamento.executadoEm)}. O valor voltou para a conta corrente da entidade.`
                : `Executado em ${formatData(pagamento.executadoEm)} e registrado no extrato público.`}
            </p>
            {pagamento.txHash && (
              <a
                href={solscanUrl(pagamento.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="tabular mt-1 inline-flex items-center gap-1 text-palha hover:underline"
              >
                {truncarHash(pagamento.txHash, 8)} <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        )}
      </Card>

      {!executado && (
        <Card className="mb-4 animate-fadeUp" style={{ animationDelay: "120ms" }}>
          <Rotulo>Assinar como</Rotulo>
          <p className="mb-2 mt-0.5 text-[11px] text-white/40">
            Sem login no MVP. Na versão real, cada diretor assina com a própria carteira.
          </p>
          <div className="flex flex-wrap gap-2">
            {diretoresAtuais.map((d) => {
              const assinou = jaAssinaram.includes(d.id);
              const ativo = d.id === diretorAtual;
              const fiscal = d.papel === "conselho";
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
                  {fiscal && <span className={`ml-1 ${ativo ? "text-mata/70" : "text-palha/80"}`}>· fiscal</span>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {executado ? (
          <BotaoLink href={resgate ? "/painel" : `/extrato/${liga.id}`}>
            {resgate ? "Voltar ao painel" : "Ver no extrato público"}
          </BotaoLink>
        ) : (
          <Botao onClick={handleAssinar} disabled={!podeAssinar}>
            {podeAssinar ? (completaria ? (resgate ? "Assinar e resgatar" : "Assinar e executar") : "Assinar") : "Você já assinou"}
          </Botao>
        )}
        <Link href="/painel" className="py-2 text-center text-sm text-white/60 hover:text-white">
          Voltar ao painel
        </Link>
      </div>

      {confirmacao && (
        <ConfirmacaoOverlay
          titulo={
            confirmacao === "executado" ? (resgate ? "Resgate executado" : "Pagamento executado") : "Assinatura registrada"
          }
          texto={
            confirmacao === "executado"
              ? resgate
                ? "Quórum atingido. O valor saiu da aplicação e voltou para a conta."
                : `${q.necessarias} de ${TOTAL_SIGNATARIOS} assinaturas. Já está no extrato público.`
              : `${n} de ${q.necessarias} assinaturas.`
          }
          tom={confirmacao === "executado" ? "entrada" : "palha"}
          duracaoMs={confirmacao === "executado" ? 2600 : 1600}
          onFim={() => setConfirmacao(null)}
        />
      )}
    </main>
  );
}
