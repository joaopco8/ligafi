"use client";

import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { Botao, BotaoLink, Card, Rotulo, Topo } from "@/components/ui";
import { formatBRL, parseValorBR } from "@/lib/format";
import { liga } from "@/lib/mock-data";
import { montarUrlSolanaPay } from "@/lib/solana/pay";

/**
 * Formulário de cobrança. Aceita `?descricao=&valor=` para pré-preencher
 * (usado pela tela /anuidade para cobrar um membro específico).
 */
export function CobrancaForm() {
  const params = useSearchParams();
  const veioDaAnuidade = params.has("descricao");

  const [descricao, setDescricao] = useState(() => params.get("descricao") ?? "");
  const [valorTexto, setValorTexto] = useState(() => {
    const v = params.get("valor");
    return v ? String(v).replace(".", ",") : "";
  });
  const [copiado, setCopiado] = useState(false);

  const valor = parseValorBR(valorTexto);
  const valido = descricao.trim().length > 0 && Number.isFinite(valor) && valor > 0;

  const url = useMemo(
    () =>
      valido
        ? montarUrlSolanaPay({
            destinatario: liga.enderecoCofre,
            valor: Math.round(valor * 100) / 100,
            label: descricao.trim(),
          })
        : null,
    [valido, valor, descricao],
  );

  const mensagem = url
    ? `${liga.sigla} · ${descricao.trim()}\nValor: ${formatBRL(valor)}\nPague pelo Solana Pay: ${url}\n\nExtrato público: /extrato/${liga.id}`
    : "";

  async function copiar() {
    if (!mensagem) return;
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copie o texto abaixo:", mensagem);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <Topo
        voltar={veioDaAnuidade ? { href: "/anuidade", label: "Anuidade" } : { href: "/painel", label: "Painel" }}
        titulo="Nova cobrança"
        sub="Gera um QR que deposita direto no cofre da entidade."
      />

      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <Rotulo>Descrição</Rotulo>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Anuidade 2026 — membro"
              maxLength={80}
              autoFocus={!veioDaAnuidade}
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Valor (R$)</Rotulo>
            <input
              type="text"
              inputMode="decimal"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              placeholder="120,00"
              className="tabular rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
            {valorTexto && !valido && descricao && (
              <span className="text-xs text-saida">Informe um valor maior que zero.</span>
            )}
          </label>
        </Card>

        <Card className="flex flex-col items-center gap-3 text-center">
          <Rotulo>QR code Solana Pay</Rotulo>
          <div
            className={`rounded-2xl bg-white p-3 transition-opacity ${url ? "opacity-100" : "opacity-20"}`}
            aria-hidden={!url}
          >
            <QRCodeSVG
              value={url ?? "solana:LigaFi"}
              size={196}
              level="M"
              bgColor="#ffffff"
              fgColor="#0F3D2E"
              includeMargin={false}
            />
          </div>
          {url ? (
            <>
              <p className="font-display text-lg font-semibold">
                {descricao.trim()} · <span className="tabular text-palha">{formatBRL(valor)}</span>
              </p>
              <p className="w-full break-all rounded-lg bg-mata px-3 py-2 text-left text-[11px] leading-relaxed text-white/50">
                {url}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/50">Preencha descrição e valor para gerar o QR.</p>
          )}
        </Card>

        <div className="flex flex-col gap-2">
          <Botao type="button" onClick={copiar} disabled={!url}>
            {copiado ? "✓ Copiado" : "Copiar link para o WhatsApp"}
          </Botao>
          {url && (
            <BotaoLink
              variante="secondary"
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no WhatsApp
            </BotaoLink>
          )}
          <p className="mt-1 text-center text-[11px] text-white/40">
            Recebido no cofre <span className="tabular">{liga.enderecoCofre.slice(0, 8)}…</span>. Aparece no extrato
            público assim que confirmado.
          </p>
        </div>
      </form>
    </main>
  );
}
