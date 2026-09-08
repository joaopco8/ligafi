"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LinhaDiretor } from "@/components/assinaturas";
import { useSaldoSol } from "@/components/header-wallet";
import { Botao, BotaoLink, Card, Rotulo } from "@/components/ui";
import { truncarEndereco } from "@/lib/format";
import { liga } from "@/lib/mock-data";
import { BRL_POR_SOL } from "@/lib/solana/config";
import { ROTULO_PAPEL, useIdentidade } from "@/lib/auth";
import { useDiretor, useGestaoAtual, useLigaFi } from "@/lib/store";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Entrada da diretoria. Lista as carteiras do wallet adapter (Phantom e
 * Solflare sempre; qualquer outra Wallet Standard quando instalada).
 */
export default function EntrarPage() {
  const router = useRouter();
  const { wallets, wallet, select, connect, disconnect, connected, connecting, publicKey } = useWallet();
  const { saldo } = useSaldoSol();
  const diretores = useLigaFi((s) => s.diretores);
  const diretorAtual = useLigaFi((s) => s.diretorAtual);
  const carteira = useLigaFi((s) => s.carteira);
  const conectarCarteira = useLigaFi((s) => s.conectarCarteira);
  const gestaoAtual = useGestaoAtual();
  const diretor = useDiretor(diretorAtual);
  const identidade = useIdentidade();

  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // `select` troca o adapter de forma assíncrona; conecta quando ele estiver ativo.
  useEffect(() => {
    if (!pendente || !wallet || wallet.adapter.name !== pendente) return;
    setPendente(null);
    connect().catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(/reject|denied|cancel|4001|closed/i.test(msg) ? "Conexão recusada na carteira." : "Não foi possível conectar. Tente de novo.");
    });
  }, [pendente, wallet, connect]);

  function escolher(nome: string) {
    setErro(null);
    if (wallet?.adapter.name === nome) {
      connect().catch(() => setErro("Conexão recusada na carteira."));
      return;
    }
    setPendente(nome);
    select(nome as never);
  }

  function entrarDemo() {
    conectarCarteira({ provedor: "demo", nome: "Modo demo", endereco: "", rede: "demo" });
    router.push("/painel");
  }

  const endereco = publicKey?.toBase58();
  const signatario = endereco ? diretores.find((d) => d.endereco === endereco) : undefined;
  const instaladas = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);
  const naoInstaladas = wallets.filter((w) => !instaladas.includes(w));

  return (
    <main className="flex flex-1 flex-col">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Rotulo>Diretoria · {liga.sigla}</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">Entrar com a carteira</h1>
          <p className="mt-1 text-sm text-white/55">Cada diretor assina com a própria carteira. Nada de senha compartilhada.</p>
        </div>
        <Link href="/" className="shrink-0 text-xs font-medium text-white/55 hover:text-white">
          ← Início
        </Link>
      </header>

      {connected && endereco ? (
        <Card className="mb-4 animate-fadeUp border-entrada/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Rotulo>Conectada · {wallet?.adapter.name}</Rotulo>
              <code className="tabular mt-1 block text-sm text-white">{truncarEndereco(endereco, 6)}</code>
              <p className="tabular mt-0.5 text-xs text-white/55">
                ◎ {saldo === null ? "…" : saldo.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                {saldo !== null && <span className="text-white/40"> · ≈ {brl.format(saldo * BRL_POR_SOL)}</span>}
              </p>
            </div>
            <button type="button" onClick={() => disconnect().catch(() => {})} className="text-xs text-white/45 hover:text-saida">
              desconectar
            </button>
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4 text-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">
              Papel:{" "}
              <span className={identidade.papel === "signatario" ? "text-entrada" : "text-white"}>
                {ROTULO_PAPEL[identidade.papel]}
              </span>
            </p>
            {signatario ? (
              <>
                <p className="mt-1 text-entrada">Carteira reconhecida como signatária da {gestaoAtual.nome}.</p>
                <ul className="mt-2">
                  <LinhaDiretor diretor={signatario.id} />
                </ul>
              </>
            ) : identidade.papel === "signatario" ? (
              <>
                <p className="mt-1 text-white/70">Modo demo: esta carteira assina como</p>
                {diretor && (
                  <ul className="mt-2">
                    <LinhaDiretor diretor={diretor.id} />
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-1 text-white/70">
                Esta carteira não é signatária da {gestaoAtual.nome}. Você pode ver o extrato público, mas não propor
                nem assinar pagamentos.
              </p>
            )}
          </div>
          <BotaoLink
            href={identidade.papel === "signatario" ? "/painel" : `/extrato/${liga.id}`}
            className="mt-4 w-full"
          >
            {identidade.papel === "signatario" ? "Ir para o painel" : "Ver extrato público"}
          </BotaoLink>
        </Card>
      ) : (
        <>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <Rotulo>Carteiras</Rotulo>
            <span className="text-xs text-white/40" aria-live="polite">
              {instaladas.length > 0 ? `${instaladas.length} detectada${instaladas.length > 1 ? "s" : ""}` : "nenhuma detectada"}
            </span>
          </div>
          <ul className="mb-3 flex flex-col gap-2">
            {[...instaladas, ...naoInstaladas].map((w, i) => {
              const nome = w.adapter.name;
              const instalada = instaladas.includes(w);
              const ocupado = connecting && wallet?.adapter.name === nome;
              return (
                <li key={nome} className="animate-fadeUp" style={{ animationDelay: `${i * 40}ms` }}>
                  <Card className="flex items-center gap-3 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.adapter.icon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{nome}</p>
                      <p className="text-[11px] text-white/45">
                        Solana · {instalada ? <span className="text-entrada">detectada</span> : "não instalada"}
                      </p>
                    </div>
                    {instalada ? (
                      <Botao className="px-4 py-2 text-sm" onClick={() => escolher(nome)} disabled={connecting}>
                        {ocupado ? "Abrindo…" : "Conectar"}
                      </Botao>
                    ) : (
                      <a
                        href={w.adapter.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-white/70 hover:border-white/40 hover:text-white"
                      >
                        Instalar ↗
                      </a>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          {erro && <p className="mb-3 px-1 text-xs text-saida">{erro}</p>}

          <Botao variante="ghost" onClick={entrarDemo} className="text-white/70">
            Continuar sem carteira (modo demo)
          </Botao>
          <p className="mt-2 text-center text-[11px] text-white/35">
            {carteira?.rede === "demo" ? "Você está em modo demo. " : ""}
            Qualquer carteira Solana compatível com Wallet Standard aparece aqui quando instalada.
          </p>
        </>
      )}
    </main>
  );
}
