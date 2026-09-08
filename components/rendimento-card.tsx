"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Botao, Card, Rotulo } from "@/components/ui";
import { formatBRL, formatData, hojeISO, mesesEntre, parseValorBR } from "@/lib/format";
import { quorumPara } from "@/lib/regras";
import { useLigaFi } from "@/lib/store";

/** Saldo parado, rendimento acumulado, data prevista de uso e botão Resgatar. */
export function RendimentoCard() {
  const router = useRouter();
  const aplicacao = useLigaFi((s) => s.aplicacao);
  const pagamentos = useLigaFi((s) => s.pagamentos);
  const proporResgate = useLigaFi((s) => s.proporResgate);

  // Data só no cliente, para SSR e cliente renderizarem igual.
  const [hoje, setHoje] = useState<string | null>(null);
  useEffect(() => setHoje(hojeISO()), []);

  const [abrindo, setAbrindo] = useState(false);
  const [valorTexto, setValorTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const meses = hoje ? mesesEntre(aplicacao.desde, hoje) : 0;
  const acumulado = aplicacao.valor * (Math.pow(1 + aplicacao.taxaMensal, meses) - 1);
  const resgatesPendentes = pagamentos.filter((p) => p.natureza === "resgate" && p.status === "pendente");
  const emAberto = resgatesPendentes.reduce((a, p) => a + p.valor, 0);
  const disponivel = Math.max(0, aplicacao.valor - emAberto);

  function abrir() {
    setValorTexto(String(disponivel).replace(".", ","));
    setErro(null);
    setAbrindo(true);
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const valor = parseValorBR(valorTexto);
    if (!(valor > 0)) return setErro("Informe um valor maior que zero.");
    if (valor > disponivel) return setErro(`Máximo disponível: ${formatBRL(disponivel)}.`);
    const p = proporResgate(Math.round(valor * 100) / 100);
    if (!p) return setErro("Não foi possível criar a proposta.");
    router.push(`/pagamento/${p.id}`);
  }

  const q = quorumPara(parseValorBR(valorTexto) || disponivel);

  return (
    <Card className="animate-fadeUp" style={{ animationDelay: "120ms" }}>
      <div className="flex items-baseline justify-between">
        <Rotulo>Rendimento</Rotulo>
        <span className="tabular text-[11px] text-white/50">{(aplicacao.taxaMensal * 100).toFixed(1).replace(".", ",")}% a.m.</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
        <div>
          <dt className="text-[11px] text-white/50">Saldo parado</dt>
          <dd className="tabular font-display text-lg font-semibold text-entrada">{formatBRL(aplicacao.valor)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-white/50">Rendimento acumulado</dt>
          <dd className="tabular font-display text-lg font-semibold text-palha">{hoje ? `+ ${formatBRL(acumulado)}` : "—"}</dd>
          <dd className="tabular text-[10px] text-white/40">
            desde {formatData(aplicacao.desde)}
            {hoje ? ` · ${meses} ${meses === 1 ? "mês" : "meses"}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-white/50">Uso previsto</dt>
          <dd className="tabular text-sm font-semibold">{formatData(aplicacao.previstoPara)}</dd>
          <dd className="truncate text-[11px] text-white/50">{aplicacao.finalidade}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-white/50">Resgate em aprovação</dt>
          <dd className="tabular text-sm font-semibold">{emAberto > 0 ? formatBRL(emAberto) : "—"}</dd>
          {resgatesPendentes.length > 0 && (
            <dd className="text-[11px] text-white/50">
              {resgatesPendentes.length} proposta{resgatesPendentes.length > 1 ? "s" : ""}
            </dd>
          )}
        </div>
      </dl>

      {abrindo ? (
        <form onSubmit={confirmar} className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4">
          <label className="flex flex-col gap-1.5">
            <Rotulo>Valor a resgatar (R$)</Rotulo>
            <input
              type="text"
              inputMode="decimal"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              autoFocus
              className="tabular rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
          </label>
          <p className="text-[11px] text-white/50">
            Vira uma proposta com quórum de <strong className="text-white">{q.necessarias} assinaturas</strong>
            {q.exigeConselho && ", incluindo o conselho fiscal"}. Máximo disponível: {formatBRL(disponivel)}.
          </p>
          {erro && <p className="text-xs text-saida">{erro}</p>}
          <div className="mt-1 flex gap-2">
            <Botao type="submit" className="flex-1">
              Propor resgate
            </Botao>
            <Botao type="button" variante="ghost" onClick={() => setAbrindo(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      ) : (
        <Botao variante="secondary" className="mt-4 w-full" onClick={abrir} disabled={disponivel <= 0}>
          {disponivel <= 0 ? "Nada disponível para resgate" : "Resgatar"}
        </Botao>
      )}
    </Card>
  );
}
