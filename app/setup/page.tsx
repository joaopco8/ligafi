"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSaldoSol } from "@/components/header-wallet";
import { BadgeRede } from "@/components/top-bar";
import { Botao, Card, Rotulo } from "@/components/ui";
import { enderecoMultisigAtivo, useCofre, type SignatarioLocal } from "@/lib/cofre-store";
import { agoraISO, parseValorBR, truncarEndereco } from "@/lib/format";
import { ASSENTOS, PAPEL_LABEL } from "@/lib/regras";
import { BRL_POR_SOL, MULTISIG_ENV, lamportsParaSol, solscanConta, solscanTx } from "@/lib/solana/config";
import { traduzirErro } from "@/lib/solana/erros";
import {
  airdropDevnet,
  assertGovernancaOnChain,
  assinadorWallet,
  criarMultisig,
  depositarNoVault,
  lerMultisig,
  lerProgramConfig,
  type MultisigInfo,
} from "@/lib/solana/squads";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const sol = (n: number) => `◎ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`;

type Linha = { nome: string; endereco: string };

function pubkeyValida(s: string): boolean {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

export default function SetupPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { saldo } = useSaldoSol();
  const cofre = useCofre((s) => s.cofre);
  const cofreHidratado = useCofre((s) => s.hidratado);
  const definirCofre = useCofre((s) => s.definirCofre);
  const limparCofre = useCofre((s) => s.limparCofre);

  const endereco = wallet.publicKey?.toBase58() ?? null;
  const enderecoAtivo = enderecoMultisigAtivo(cofre);

  // --- estado da chain -------------------------------------------------
  const [info, setInfo] = useState<MultisigInfo | null>(null);
  const [infoErro, setInfoErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [taxa, setTaxa] = useState<number | null>(null);

  const recarregar = useCallback(async () => {
    if (!enderecoAtivo) {
      setInfo(null);
      return;
    }
    setLendo(true);
    setInfoErro(null);
    try {
      setInfo(await lerMultisig(connection, new PublicKey(enderecoAtivo)));
    } catch (e) {
      setInfo(null);
      setInfoErro(traduzirErro(e).message);
    } finally {
      setLendo(false);
    }
  }, [connection, enderecoAtivo]);

  useEffect(() => {
    if (cofreHidratado) recarregar();
  }, [cofreHidratado, recarregar]);

  useEffect(() => {
    lerProgramConfig(connection)
      .then((c) => setTaxa(lamportsParaSol(c.taxaCriacaoLamports)))
      .catch(() => setTaxa(null));
  }, [connection]);

  // --- ações -----------------------------------------------------------
  const [ocupado, setOcupado] = useState<null | "airdrop" | "criar" | "depositar" | "importar">(null);
  const [erro, setErro] = useState<{ msg: string; faucet?: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function falhar(e: unknown) {
    const t = traduzirErro(e);
    console.error(e);
    setErro({ msg: t.message, faucet: t.codigo === "airdrop_limite" });
  }

  async function airdrop() {
    if (!wallet.publicKey) return;
    setErro(null);
    setAviso(null);
    setOcupado("airdrop");
    try {
      await airdropDevnet(connection, wallet.publicKey, 1);
      setAviso("1 SOL de devnet creditado.");
    } catch (e) {
      falhar(e);
    } finally {
      setOcupado(null);
    }
  }

  // --- formulário de criação --------------------------------------------
  const [nomeEntidade, setNomeEntidade] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>(() => ASSENTOS.map(() => ({ nome: "", endereco: "" })));
  const [threshold, setThreshold] = useState(3);
  const [criado, setCriado] = useState<{ multisig: string; vault: string; tx: string } | null>(null);

  useEffect(() => {
    if (endereco && !linhas[0].endereco) {
      setLinhas((ls) => ls.map((l, i) => (i === 0 ? { ...l, endereco } : l)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endereco]);

  const preenchidas = linhas.filter((l) => l.endereco.trim());
  const invalidas = preenchidas.filter((l) => !pubkeyValida(l.endereco));
  const duplicadas = new Set(preenchidas.map((l) => l.endereco.trim())).size !== preenchidas.length;
  const formValido =
    nomeEntidade.trim().length >= 2 &&
    preenchidas.length >= 1 &&
    invalidas.length === 0 &&
    !duplicadas &&
    threshold >= 1 &&
    threshold <= preenchidas.length;

  function editar(i: number, campo: keyof Linha, valor: string) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!formValido || !wallet.publicKey) return;
    setErro(null);
    setAviso(null);
    setOcupado("criar");
    try {
      const membros = preenchidas.map((l) => new PublicKey(l.endereco.trim()));
      const r = await criarMultisig({
        connection,
        assinador: assinadorWallet(wallet),
        membros,
        threshold,
        memo: `LigaFi ${nomeEntidade.trim()}`,
      });
      const signatarios: SignatarioLocal[] = preenchidas.map((l, i) => ({
        endereco: l.endereco.trim(),
        nome: l.nome.trim() || `Signatário ${i + 1}`,
        cargo: PAPEL_LABEL[ASSENTOS[Math.min(i, ASSENTOS.length - 1)]],
      }));
      definirCofre({
        multisigPda: r.multisigPda.toBase58(),
        vaultPda: r.vaultPda.toBase58(),
        nomeEntidade: nomeEntidade.trim(),
        threshold: r.threshold,
        signatarios,
        criadoEm: agoraISO(),
        assinaturaCriacao: r.assinatura,
        propostas: {},
      });
      setCriado({ multisig: r.multisigPda.toBase58(), vault: r.vaultPda.toBase58(), tx: r.assinatura });
      setInfo(r);
    } catch (e) {
      falhar(e);
    } finally {
      setOcupado(null);
    }
  }

  // --- depósito -----------------------------------------------------------
  const [deposito, setDeposito] = useState("0,1");
  async function depositar(e: React.FormEvent) {
    e.preventDefault();
    if (!info || !wallet.publicKey) return;
    const v = parseValorBR(deposito);
    if (!(v > 0)) return setErro({ msg: "Informe um valor em SOL maior que zero." });
    setErro(null);
    setAviso(null);
    setOcupado("depositar");
    try {
      const sig = await depositarNoVault({
        connection,
        assinador: assinadorWallet(wallet),
        multisigPda: info.multisigPda,
        lamports: Math.round(v * LAMPORTS_PER_SOL),
      });
      setAviso(`Depósito de ${sol(v)} confirmado.`);
      console.info("depósito", solscanTx(sig));
      await recarregar();
    } catch (e) {
      falhar(e);
    } finally {
      setOcupado(null);
    }
  }

  // --- importar existente ---------------------------------------------------
  const [importar, setImportar] = useState("");
  async function importarCofre(e: React.FormEvent) {
    e.preventDefault();
    if (!pubkeyValida(importar)) return setErro({ msg: "Endereço de multisig inválido." });
    setErro(null);
    setOcupado("importar");
    try {
      const i = await lerMultisig(connection, new PublicKey(importar.trim()));
      assertGovernancaOnChain(i);
      definirCofre({
        multisigPda: i.multisigPda.toBase58(),
        vaultPda: i.vaultPda.toBase58(),
        nomeEntidade: cofre?.nomeEntidade || "Entidade",
        threshold: i.threshold,
        signatarios: i.membros.map((m, k) => ({ endereco: m.key.toBase58(), nome: `Signatário ${k + 1}`, cargo: PAPEL_LABEL[ASSENTOS[Math.min(k, 4)]] })),
        criadoEm: agoraISO(),
        propostas: {},
      });
      setImportar("");
      setInfo(i);
    } catch (e) {
      falhar(e);
    } finally {
      setOcupado(null);
    }
  }

  // --- render ---------------------------------------------------------------
  if (!wallet.connected || !endereco) {
    return (
      <main className="flex flex-1 flex-col">
        <header className="mb-4">
          <Rotulo>Cofre da entidade</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">Conecte a carteira para criar o cofre</h1>
          <p className="mt-1 text-sm text-white/60">
            Quem cria paga a taxa de criação em SOL de devnet. Depois, o cofre é da entidade: sem dono.
          </p>
        </header>
        <Botao onClick={() => setVisible(true)} disabled={wallet.connecting}>
          {wallet.connecting ? "Conectando…" : "Conectar carteira"}
        </Botao>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Rotulo>Cofre da entidade</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">Setup on-chain</h1>
          <p className="mt-1 text-sm text-white/60">Multisig Squads v4 em devnet. O endereço fica salvo neste navegador.</p>
        </div>
        <Link href="/painel" className="shrink-0 text-xs font-medium text-white/60 hover:text-white">
          ← Painel
        </Link>
      </header>

      {/* Carteira + airdrop */}
      <Card className="mb-4 animate-fadeUp">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Rotulo>Sua carteira</Rotulo>
            <code className="tabular mt-1 block text-sm">{truncarEndereco(endereco, 6)}</code>
            <p className="tabular mt-0.5 text-xs text-white/55">
              {saldo === null ? "…" : sol(saldo)}
              {saldo !== null && <span className="text-white/40"> · ≈ {brl.format(saldo * BRL_POR_SOL)}</span>}
            </p>
          </div>
          <BadgeRede />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao variante="secondary" className="px-4 py-2 text-sm" onClick={airdrop} disabled={!!ocupado}>
            {ocupado === "airdrop" ? "Pedindo airdrop…" : "Airdrop 1 SOL (devnet)"}
          </Botao>
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl px-3 py-2 text-xs text-white/60 hover:text-white"
          >
            faucet.solana.com ↗
          </a>
        </div>
        {taxa !== null && (
          <p className="mt-3 text-[11px] text-white/45">
            Taxa de criação do programa Squads: <span className="tabular text-white/70">{sol(taxa)}</span> + rent das contas.
          </p>
        )}
      </Card>

      {erro && (
        <div className="mb-4 rounded-2xl border border-saida/40 bg-saida/10 px-4 py-3 text-sm text-white/85" role="alert">
          {erro.msg}
          {erro.faucet && (
            <>
              {" "}
              <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer" className="text-palha underline">
                Abrir faucet
              </a>
            </>
          )}
        </div>
      )}
      {aviso && (
        <div className="mb-4 rounded-2xl border border-entrada/40 bg-entrada/10 px-4 py-3 text-sm text-white/85" role="status">
          {aviso}
        </div>
      )}

      {/* Cofre ativo */}
      {enderecoAtivo && (
        <section className="mb-5">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <Rotulo>Cofre ativo{MULTISIG_ENV ? " · via NEXT_PUBLIC_MULTISIG_ADDRESS" : ""}</Rotulo>
            <button type="button" onClick={recarregar} className="text-xs text-white/40 hover:text-white" disabled={lendo}>
              {lendo ? "lendo…" : "recarregar"}
            </button>
          </div>
          <Card className={info?.governancaOnChain ? "border-entrada/40" : infoErro || info ? "border-saida/40" : ""}>
            {info ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold">{cofre?.nomeEntidade ?? "Entidade"}</p>
                    <a
                      href={solscanConta(info.multisigPda.toBase58())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tabular text-xs text-white/55 hover:text-white"
                    >
                      multisig {truncarEndereco(info.multisigPda.toBase58(), 6)} ↗
                    </a>
                    <br />
                    <a
                      href={solscanConta(info.vaultPda.toBase58())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tabular text-xs text-white/55 hover:text-white"
                    >
                      vault {truncarEndereco(info.vaultPda.toBase58(), 6)} ↗
                    </a>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      info.governancaOnChain ? "bg-entrada/15 text-entrada" : "bg-saida/15 text-saida"
                    }`}
                  >
                    {info.governancaOnChain ? "✓ governança 100% on-chain" : "✗ tem config_authority"}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4">
                  <div>
                    <dt className="text-[11px] text-white/50">Saldo do vault</dt>
                    <dd className="tabular font-display text-lg font-semibold text-palha">{sol(lamportsParaSol(info.saldoVaultLamports))}</dd>
                    <dd className="tabular text-[10px] text-white/40">≈ {brl.format(lamportsParaSol(info.saldoVaultLamports) * BRL_POR_SOL)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-white/50">Quórum</dt>
                    <dd className="tabular font-display text-lg font-semibold">
                      {info.threshold} de {info.membros.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-white/50">Propostas</dt>
                    <dd className="tabular font-display text-lg font-semibold">{info.transactionIndex.toString()}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-white/50">
                  config_authority ={" "}
                  <code className="text-white/70">{info.governancaOnChain ? "null" : truncarEndereco(info.configAuthority.toBase58())}</code>
                  {info.governancaOnChain
                    ? ". Ninguém troca signatários ou threshold por fora: só por proposta aprovada."
                    : ". Este cofre não atende à regra do LigaFi."}
                </p>
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
                  {info.membros.map((m, k) => {
                    const local = cofre?.signatarios.find((s) => s.endereco === m.key.toBase58());
                    const euMesmo = m.key.toBase58() === endereco;
                    return (
                      <li key={m.key.toBase58()} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {local?.nome ?? `Signatário ${k + 1}`}
                          <span className="text-white/40"> · {local?.cargo ?? "—"}</span>
                          {euMesmo && <span className="ml-1 text-[10px] font-semibold uppercase text-palha">você</span>}
                        </span>
                        <code className="tabular shrink-0 text-[11px] text-white/45">{truncarEndereco(m.key.toBase58())}</code>
                      </li>
                    );
                  })}
                </ul>

                <form onSubmit={depositar} className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={deposito}
                    onChange={(e) => setDeposito(e.target.value)}
                    className="tabular w-28 rounded-xl border border-white/10 bg-mata px-3 py-2 text-sm outline-none focus:border-palha"
                    aria-label="Valor em SOL"
                  />
                  <Botao type="submit" className="flex-1 px-4 py-2 text-sm" disabled={!!ocupado}>
                    {ocupado === "depositar" ? "Depositando…" : "Depositar SOL no vault"}
                  </Botao>
                </form>
              </>
            ) : infoErro ? (
              <p className="text-sm text-saida">{infoErro}</p>
            ) : (
              <p className="text-sm text-white/50">Lendo o cofre na devnet…</p>
            )}
          </Card>
          {!MULTISIG_ENV && cofre && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Esquecer este cofre neste navegador? O multisig continua existindo na chain.")) {
                  limparCofre();
                  setInfo(null);
                  setCriado(null);
                }
              }}
              className="mt-2 w-full py-1 text-center text-[11px] text-white/35 hover:text-saida"
            >
              esquecer este cofre neste navegador
            </button>
          )}
        </section>
      )}

      {criado && (
        <Card className="mb-5 animate-pop border-entrada/50 bg-entrada/[0.06]">
          <p className="font-display text-lg font-semibold text-entrada">Cofre criado</p>
          <p className="mt-1 text-sm text-white/75">
            <code>config_authority = null</code> verificado na chain. Governança 100% on-chain.
          </p>
          <a href={solscanTx(criado.tx)} target="_blank" rel="noopener noreferrer" className="tabular mt-2 inline-block text-xs text-palha hover:underline">
            ver transação de criação ↗
          </a>
        </Card>
      )}

      {/* Novo cofre */}
      {!MULTISIG_ENV && (
        <form onSubmit={criar} className="mb-5 flex flex-col gap-3">
          <div className="px-1">
            <Rotulo>{enderecoAtivo ? "Criar outro cofre" : "Criar o cofre"}</Rotulo>
          </div>
          <Card className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <Rotulo>Entidade</Rotulo>
              <input
                type="text"
                value={nomeEntidade}
                onChange={(e) => setNomeEntidade(e.target.value)}
                placeholder="Liga Acadêmica de Medicina de Emergência"
                className="rounded-xl border border-white/10 bg-mata px-4 py-3 text-base outline-none placeholder:text-white/30 focus:border-palha"
              />
            </label>
            <div className="flex items-baseline justify-between">
              <Rotulo>Signatários</Rotulo>
              <span className="text-[11px] text-white/45">endereços Solana das carteiras dos diretores</span>
            </div>
            <ol className="flex flex-col gap-3">
              {linhas.map((l, i) => {
                const ruim = l.endereco.trim() && !pubkeyValida(l.endereco);
                return (
                  <li key={i} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.08] p-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                      {PAPEL_LABEL[ASSENTOS[i]]}
                      {i === 0 && <span className="ml-2 font-normal normal-case text-palha/80">sua carteira</span>}
                    </span>
                    <input
                      type="text"
                      value={l.nome}
                      onChange={(e) => editar(i, "nome", e.target.value)}
                      placeholder="Nome (fica só neste navegador)"
                      className="rounded-lg border border-white/10 bg-mata px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-palha"
                    />
                    <input
                      type="text"
                      value={l.endereco}
                      onChange={(e) => editar(i, "endereco", e.target.value)}
                      placeholder="Endereço da carteira"
                      spellCheck={false}
                      className={`tabular rounded-lg border bg-mata px-3 py-2 font-mono text-xs outline-none placeholder:text-white/30 focus:border-palha ${
                        ruim ? "border-saida/60" : "border-white/10"
                      }`}
                    />
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <div>
                <Rotulo>Threshold</Rotulo>
                <p className="text-[11px] text-white/45">assinaturas para executar qualquer proposta</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setThreshold((t) => Math.max(1, t - 1))} className="grid h-8 w-8 place-items-center rounded-full border border-white/15 hover:border-white/40">
                  −
                </button>
                <span className="tabular w-16 text-center font-display text-lg font-semibold">
                  {threshold} de {preenchidas.length || "—"}
                </span>
                <button type="button" onClick={() => setThreshold((t) => Math.min(Math.max(1, preenchidas.length), t + 1))} className="grid h-8 w-8 place-items-center rounded-full border border-white/15 hover:border-white/40">
                  +
                </button>
              </div>
            </div>
            {duplicadas && <p className="text-xs text-saida">Há endereços repetidos.</p>}
            {threshold > preenchidas.length && preenchidas.length > 0 && (
              <p className="text-xs text-saida">Threshold maior que o número de signatários.</p>
            )}
          </Card>
          <Botao type="submit" disabled={!formValido || !!ocupado}>
            {ocupado === "criar" ? "Criando na devnet…" : "Criar cofre com governança on-chain"}
          </Botao>
          <p className="text-center text-[11px] text-white/40">
            Sua carteira assina uma transação de criação. Só quem estiver na lista consegue propor e aprovar depois.
          </p>
        </form>
      )}

      {/* Importar existente */}
      {!MULTISIG_ENV && (
        <form onSubmit={importarCofre} className="mb-4 flex flex-col gap-2">
          <Rotulo className="px-1">Já tem um multisig Squads?</Rotulo>
          <div className="flex gap-2">
            <input
              type="text"
              value={importar}
              onChange={(e) => setImportar(e.target.value)}
              placeholder="Endereço do multisig"
              spellCheck={false}
              className="tabular min-w-0 flex-1 rounded-xl border border-white/10 bg-mata px-3 py-2 font-mono text-xs outline-none placeholder:text-white/30 focus:border-palha"
            />
            <Botao type="submit" variante="secondary" className="px-4 py-2 text-sm" disabled={!!ocupado || !importar}>
              {ocupado === "importar" ? "Lendo…" : "Usar"}
            </Botao>
          </div>
          <p className="px-1 text-[11px] text-white/40">Só aceita cofres sem config_authority.</p>
        </form>
      )}
    </main>
  );
}

