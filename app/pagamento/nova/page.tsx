"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequerSignatario } from "@/components/requer-signatario";
import { BadgeRede } from "@/components/top-bar";
import { Botao, Card, Rotulo, Topo } from "@/components/ui";
import { categorias, ordemCategorias } from "@/lib/categorias";
import { useCofre } from "@/lib/cofre-store";
import { formatBRL, parseValorBR } from "@/lib/format";
import { BRL_POR_SOL, DEMO_MODE, lamportsParaSol } from "@/lib/solana/config";
import { assinadorWallet, proporTransferencia } from "@/lib/solana/squads";
import { useChain } from "@/lib/tesouraria/chain-store";
import { Mensagens, useAcao } from "@/lib/tesouraria/use-acao";
import type { Categoria } from "@/lib/types";

export default function NovaPropostaPage() {
  return (
    <RequerSignatario titulo="Nova proposta">
      {DEMO_MODE ? <SoOnChain /> : <NovaProposta />}
    </RequerSignatario>
  );
}

function SoOnChain() {
  return (
    <main className="flex flex-1 flex-col">
      <Topo voltar={{ href: "/painel", label: "Painel" }} titulo="Só no modo on-chain" sub="Em modo demo os pagamentos já vêm prontos no painel." />
    </main>
  );
}

function pubkeyValida(s: string): boolean {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

function NovaProposta() {
  const router = useRouter();
  const wallet = useWallet();
  const { info, connection, recarregar } = useChain();
  const anotarProposta = useCofre((s) => s.anotarProposta);
  const { ocupado, erro, aviso, rodar } = useAcao();

  const [destinatario, setDestinatario] = useState("");
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [valorTexto, setValorTexto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("outros");

  const valor = parseValorBR(valorTexto);
  const saldoVault = info ? lamportsParaSol(info.saldoVaultLamports) : 0;
  const destinoOk = pubkeyValida(destinatario);
  const valorOk = Number.isFinite(valor) && valor > 0 && valor <= saldoVault;
  const valido = destinoOk && valorOk && descricao.trim().length >= 3;

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || !info) return;
    const r = await rodar("propor", () =>
      proporTransferencia({
        connection,
        assinador: assinadorWallet(wallet),
        multisigPda: info.multisigPda,
        destinatario: new PublicKey(destinatario.trim()),
        lamports: Math.round(valor * LAMPORTS_PER_SOL),
        descricao: descricao.trim(),
        categoria,
      }),
    );
    if (!r) return;
    anotarProposta(r.transactionIndex, { descricao: descricao.trim(), categoria, destinatarioNome: destinatarioNome.trim() || undefined });
    await recarregar();
    router.push(`/pagamento/${r.transactionIndex.toString()}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <Topo
        voltar={{ href: "/painel", label: "Painel" }}
        titulo="Nova proposta de pagamento"
        sub="Sua carteira propõe e já dá a 1ª assinatura. Executa quando atingir o quórum."
        acao={<BadgeRede className="mt-1" />}
      />

      <Mensagens erro={erro} aviso={aviso} />

      <form onSubmit={submeter} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <Rotulo>Descrição</Rotulo>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Coffee break — III Simpósio"
              maxLength={120}
              autoFocus
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
            <span className="text-[11px] text-white/40">Vai gravada na chain (memo). Aparece no extrato público.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Categoria</Rotulo>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none focus:border-palha"
            >
              {ordemCategorias.map((c) => (
                <option key={c} value={c}>
                  {categorias[c].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Valor (SOL)</Rotulo>
            <input
              type="text"
              inputMode="decimal"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              placeholder="0,05"
              className="tabular rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
            <span className="tabular text-[11px] text-white/40">
              {Number.isFinite(valor) && valor > 0 ? `≈ ${formatBRL(valor * BRL_POR_SOL)} · ` : ""}
              disponível no cofre: ◎ {saldoVault.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
            </span>
            {valorTexto && !valorOk && <span className="text-xs text-saida">Valor inválido ou maior que o saldo do cofre.</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Destinatário (endereço Solana)</Rotulo>
            <input
              type="text"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Endereço da carteira que recebe"
              spellCheck={false}
              className={`tabular rounded-xl border bg-mata px-4 py-3 font-mono text-xs outline-none placeholder:text-white/30 focus:border-palha ${
                destinatario && !destinoOk ? "border-saida/60" : "border-white/10"
              }`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Nome do destinatário (opcional, fica neste navegador)</Rotulo>
            <input
              type="text"
              value={destinatarioNome}
              onChange={(e) => setDestinatarioNome(e.target.value)}
              placeholder="Sabor & Cia Buffet"
              className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
            />
          </label>
        </Card>
        <Botao type="submit" disabled={!valido || !!ocupado || !info}>
          {ocupado ? "Enviando para a devnet…" : "Propor e assinar"}
        </Botao>
        <p className="text-center text-[11px] text-white/40">
          Quórum {info?.threshold ?? "—"} de {info?.membros.length ?? "—"}. A transferência só sai do cofre quando executada.
        </p>
      </form>
    </main>
  );
}
