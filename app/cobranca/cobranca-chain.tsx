"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeRede } from "@/components/top-bar";
import { Botao, BotaoLink, Card, Rotulo, Topo } from "@/components/ui";
import { useCofre } from "@/lib/cofre-store";
import { agoraISO, formatBRL, formatDataHora, parseValorBR, truncarEndereco } from "@/lib/format";
import { BRL_POR_SOL, lamportsParaSol, solscanTx } from "@/lib/solana/config";
import { gerarReference, montarTransacaoPagamento, montarUrlSolanaPay, solParaLamports, type StatusCobranca } from "@/lib/solana/pay";
import { Mensagens, useAcao } from "@/lib/tesouraria/use-acao";

const formatSol = (n: number) => `◎ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;

/**
 * Cobrança Solana Pay real: URL para o vault com reference única e
 * verificação on-chain (pendente → confirmado) por polling em /api.
 */
export function CobrancaChain() {
  const params = useSearchParams();
  const veioDaAnuidade = params.has("descricao");
  const cofre = useCofre((s) => s.cofre);
  const cobrancas = useCofre((s) => s.cofre?.cobrancas ?? []);
  const registrarCobranca = useCofre((s) => s.registrarCobranca);
  const atualizarCobranca = useCofre((s) => s.atualizarCobranca);
  const { connection } = useConnection();
  const wallet = useWallet();
  const { ocupado, erro, aviso, rodar } = useAcao();

  const vault = cofre?.vaultPda ?? null;

  const [descricao, setDescricao] = useState(() => params.get("descricao") ?? "");
  const [valorTexto, setValorTexto] = useState(() => {
    // Vindo da anuidade o valor é em R$: converte para SOL pela cotação fixa.
    const v = Number(params.get("valor"));
    return v > 0 ? (v / BRL_POR_SOL).toFixed(4).replace(".", ",") : "";
  });
  const [reference, setReference] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusCobranca>({ status: "pendente" });
  const [copiado, setCopiado] = useState(false);

  const valor = parseValorBR(valorTexto);
  const valido = descricao.trim().length > 0 && Number.isFinite(valor) && valor > 0 && !!vault;
  const lamports = valido ? solParaLamports(valor) : 0;

  const url = useMemo(
    () =>
      valido && reference && vault
        ? montarUrlSolanaPay({
            destinatario: vault,
            valor: lamportsParaSol(lamports),
            label: cofre?.nomeEntidade ?? "LigaFi",
            message: descricao.trim(),
            reference,
            memo: `LigaFi:${descricao.trim().replace(/\|/g, "/")}|anuidade`,
          })
        : null,
    [valido, reference, vault, lamports, cofre?.nomeEntidade, descricao],
  );

  function gerar() {
    if (!valido) return;
    const ref = gerarReference();
    setReference(ref);
    setStatus({ status: "pendente" });
    registrarCobranca({ reference: ref, descricao: descricao.trim(), lamports, criadaEm: agoraISO() });
  }

  // Polling da verificação enquanto pendente.
  const verificar = useCallback(async () => {
    if (!reference || !vault || !lamports) return;
    try {
      const r = await fetch(`/api/cobranca/verificar?reference=${reference}&vault=${vault}&lamports=${lamports}`);
      const j = (await r.json()) as StatusCobranca & { erro?: string };
      if (r.ok && !j.erro) {
        setStatus(j);
        if (j.status !== "pendente") atualizarCobranca(reference, { sig: j.sig, status: j.status, lamportsRecebidos: j.lamportsRecebidos });
      }
    } catch {
      /* tenta de novo no próximo tick */
    }
  }, [reference, vault, lamports, atualizarCobranca]);

  useEffect(() => {
    if (!reference || status.status !== "pendente") return;
    verificar();
    const t = setInterval(verificar, 5_000);
    return () => clearInterval(t);
  }, [reference, status.status, verificar]);

  const mensagem = url
    ? `${cofre?.nomeEntidade ?? "LigaFi"} · ${descricao.trim()}\nValor: ${formatSol(lamportsParaSol(lamports))} (≈ ${formatBRL(lamportsParaSol(lamports) * BRL_POR_SOL)})\nPague pelo Solana Pay (devnet): ${url}`
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

  /** Atalho de demonstração: a carteira conectada paga a própria cobrança. */
  async function pagarComCarteira() {
    if (!url || !reference || !vault || !wallet.publicKey) return;
    await rodar(
      "pagar",
      async () => {
        const tx = montarTransacaoPagamento({
          pagador: wallet.publicKey!,
          destinatario: new PublicKey(vault),
          lamports,
          reference: new PublicKey(reference),
          memo: `LigaFi:${descricao.trim().replace(/\|/g, "/")}|anuidade`,
        });
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey!;
        const sig = await wallet.sendTransaction(tx, connection, { preflightCommitment: "confirmed" });
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        return sig;
      },
      "Pagamento enviado. Verificando na chain…",
    );
    await verificar();
  }

  const confirmado = status.status === "confirmado";

  return (
    <main className="flex flex-1 flex-col">
      <Topo
        voltar={veioDaAnuidade ? { href: "/anuidade", label: "Anuidade" } : { href: "/painel", label: "Painel" }}
        titulo="Nova cobrança"
        sub="Solana Pay para o cofre da entidade. Cada cobrança tem uma reference única."
        acao={<BadgeRede className="mt-1" />}
      />

      <Mensagens erro={erro} aviso={aviso} />

      <form className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), gerar())}>
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
              disabled={!!reference && !confirmado}
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Valor (SOL)</Rotulo>
            <input
              type="text"
              inputMode="decimal"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              placeholder="0,05"
              disabled={!!reference && !confirmado}
              className="tabular rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha disabled:opacity-60"
            />
            {Number.isFinite(valor) && valor > 0 && <span className="tabular text-[11px] text-white/40">≈ {formatBRL(valor * BRL_POR_SOL)}</span>}
          </label>
          {vault && (
            <p className="text-[11px] text-white/45">
              Recebe no vault <code className="tabular text-white/70">{truncarEndereco(vault, 6)}</code>. Aparece no extrato público quando confirmar.
            </p>
          )}
        </Card>

        {!reference || confirmado ? (
          <Botao type="submit" disabled={!valido}>
            {confirmado ? "Gerar outra cobrança" : "Gerar QR de cobrança"}
          </Botao>
        ) : null}
      </form>

      {url && reference && (
        <Card className={`mt-4 flex flex-col items-center gap-3 text-center animate-fadeUp ${confirmado ? "border-entrada/50" : ""}`}>
          <div className="flex w-full items-center justify-between">
            <Rotulo>QR code Solana Pay</Rotulo>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                confirmado ? "bg-entrada/15 text-entrada" : status.status === "valor_diferente" ? "bg-palha/15 text-palha" : "bg-white/10 text-white/70"
              }`}
              aria-live="polite"
            >
              {confirmado ? (
                "✓ Confirmado"
              ) : status.status === "valor_diferente" ? (
                "Valor diferente"
              ) : (
                <>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-palha" /> Aguardando pagamento
                </>
              )}
            </span>
          </div>
          <div className={`rounded-2xl bg-white p-3 transition-opacity ${confirmado ? "opacity-40" : ""}`}>
            <QRCodeSVG value={url} size={196} level="M" bgColor="#ffffff" fgColor="#0F3D2E" includeMargin={false} />
          </div>
          <p className="text-lg font-semibold">
            {descricao.trim()} · <span className="tabular text-palha">{formatSol(lamportsParaSol(lamports))}</span>
          </p>
          <p className="w-full break-all rounded-lg bg-mata px-3 py-2 text-left text-[11px] leading-relaxed text-white/50">{url}</p>

          {confirmado && status.sig && (
            <div className="w-full rounded-xl border border-entrada/30 bg-entrada/[0.06] p-3 text-left text-sm">
              <p className="text-entrada">
                Recebido {formatSol(lamportsParaSol(status.lamportsRecebidos ?? lamports))}
                {status.pagador && <span className="text-white/60"> de {truncarEndereco(status.pagador)}</span>}
                {status.timestamp && <span className="text-white/45"> · {formatDataHora(new Date(status.timestamp * 1000).toISOString().slice(0, 19))}</span>}
              </p>
              <a href={solscanTx(status.sig)} target="_blank" rel="noopener noreferrer" className="tabular mt-1 inline-block text-xs text-palha hover:underline">
                {truncarEndereco(status.sig, 8)} ↗ Solscan
              </a>
            </div>
          )}
        </Card>
      )}

      {url && !confirmado && (
        <div className="mt-3 flex flex-col gap-2">
          <Botao type="button" onClick={copiar}>
            {copiado ? "✓ Copiado" : "Copiar link para o WhatsApp"}
          </Botao>
          <BotaoLink variante="secondary" href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer">
            Abrir no WhatsApp
          </BotaoLink>
          {wallet.connected && (
            <Botao variante="ghost" className="text-white/70" onClick={pagarComCarteira} disabled={!!ocupado}>
              {ocupado === "pagar" ? "Pagando…" : "Pagar agora com minha carteira (teste)"}
            </Botao>
          )}
          <p className="text-center text-[11px] text-white/40">
            Reference <code className="tabular">{truncarEndereco(reference!, 6)}</code>. Verificando a cada 5 s.
          </p>
        </div>
      )}

      {cobrancas.length > 0 && (
        <section className="mt-8">
          <Rotulo className="mb-2 px-1">Cobranças deste navegador</Rotulo>
          <Card className="divide-y divide-white/[0.06] p-0">
            {[...cobrancas].reverse().slice(0, 8).map((c) => (
              <div key={c.reference} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{c.descricao}</p>
                  <p className="tabular text-[11px] text-white/45">
                    {formatSol(lamportsParaSol(c.lamports))} · {c.criadaEm.slice(0, 10)}
                  </p>
                </div>
                {c.status === "confirmado" && c.sig ? (
                  <a href={solscanTx(c.sig)} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-entrada/15 px-2 py-0.5 text-[11px] font-semibold text-entrada">
                    Pago ↗
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDescricao(c.descricao);
                      setValorTexto(lamportsParaSol(c.lamports).toString().replace(".", ","));
                      setReference(c.reference);
                      setStatus({ status: "pendente" });
                    }}
                    className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/70 hover:border-white/40"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}
    </main>
  );
}
