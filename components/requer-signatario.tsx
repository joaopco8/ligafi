"use client";

import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { LinhaDiretor } from "@/components/assinaturas";
import { Botao, BotaoLink, Card, Rotulo } from "@/components/ui";
import { ROTULO_PAPEL, useIdentidade } from "@/lib/auth";
import { truncarEndereco } from "@/lib/format";
import { liga } from "@/lib/mock-data";
import { DEMO_MODE } from "@/lib/solana/config";
import { useGestaoAtual, useLigaFi } from "@/lib/store";

/**
 * Gate das rotas da diretoria. Só renderiza `children` para signatário
 * da gestão atual. O extrato não passa por aqui: é público.
 */
export function RequerSignatario({ children, titulo = "Área da diretoria" }: { children: ReactNode; titulo?: string }) {
  const id = useIdentidade();
  const { setVisible } = useWalletModal();
  const gestaoAtual = useGestaoAtual();
  const conectarCarteira = useLigaFi((s) => s.conectarCarteira);

  if (id.carregando) {
    return (
      <main className="flex flex-1 flex-col gap-3" aria-busy="true">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-24 animate-pulse rounded-2xl bg-mata-card" />
        <div className="h-24 animate-pulse rounded-2xl bg-mata-card" />
        <p className="text-center text-xs text-white/40">Verificando carteira…</p>
      </main>
    );
  }

  if (id.papel === "signatario") return <>{children}</>;

  const semCarteira = !id.conectada;

  return (
    <main className="flex flex-1 flex-col">
      <header className="mb-4">
        <Rotulo>{titulo}</Rotulo>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">
          {semCarteira ? "Conecte a carteira para continuar" : "Esta carteira não assina pela liga"}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {semCarteira
            ? `Só os 5 signatários da ${gestaoAtual.nome} entram aqui. A identidade é a carteira: sem senha.`
            : `Só os 5 signatários da ${gestaoAtual.nome} podem propor e assinar pagamentos.`}
        </p>
      </header>

      {!semCarteira && (
        <Card className="mb-4">
          <Rotulo>Carteira conectada</Rotulo>
          <code className="tabular mt-1 block text-sm">{truncarEndereco(id.endereco ?? "", 6)}</code>
          <p className="mt-1 text-xs text-white/55">
            Papel: <span className="text-white">{ROTULO_PAPEL[id.papel]}</span>
            {id.membro && <> · {id.membro.nome}</>}
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <Rotulo>Signatários da {gestaoAtual.nome}</Rotulo>
        <ul className="mt-2 flex flex-col gap-2">
          {gestaoAtual.diretores.map((d) => (
            <LinhaDiretor key={d} diretor={d} tom="neutro" />
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-white/45">
          Acha que deveria estar na lista? A troca de signatários é uma proposta on-chain aprovada por 3 dos 5 atuais.
        </p>
      </Card>

      <div className="mt-auto flex flex-col gap-2">
        {semCarteira && <Botao onClick={() => setVisible(true)}>Conectar carteira</Botao>}
        <BotaoLink href={`/extrato/${liga.id}`} variante={semCarteira ? "secondary" : "primary"}>
          Ver extrato público
        </BotaoLink>
        {DEMO_MODE && semCarteira && (
          <Botao
            variante="ghost"
            className="text-white/70"
            onClick={() => conectarCarteira({ provedor: "demo", nome: "Modo demo", endereco: "", rede: "demo" })}
          >
            Continuar em modo demo
          </Botao>
        )}
        <Link href="/entrar" className="py-1 text-center text-xs text-white/50 hover:text-white">
          Ver carteiras disponíveis
        </Link>
      </div>
    </main>
  );
}
