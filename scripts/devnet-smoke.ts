// Smoke test em devnet: `npm run smoke:devnet`. Keypairs efêmeros gerados aqui; nada é salvo.
// Teste headless em devnet com keypairs EFÊMEROS (gerados aqui, nunca salvos).
// Fluxo: airdrop → cria multisig 3/2 (config_authority null) → deposita →
// propõe transferência com memo → aprova → executa → troca de signatário.
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import { readFileSync } from "fs";

function assert(cond: unknown, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; throw new Error(msg); } else console.log("ok:", msg);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const S = await import("../lib/solana/squads");
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");

  // SMOKE_KEYPAIR_PATH: JSON com a secret key de uma carteira de TESTE fora do
  // repo, já fundada em devnet. Sem ela, tenta airdrop (sujeito a rate limit).
  const A = process.env.SMOKE_KEYPAIR_PATH
    ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.SMOKE_KEYPAIR_PATH, "utf8"))))
    : Keypair.generate();
  const B = Keypair.generate(), C = Keypair.generate(), E = Keypair.generate();
  const D = Keypair.generate().publicKey; // destinatário
  console.log("A", A.publicKey.toBase58());

  // airdrop com retry (pulado se A já tem saldo)
  let ok = (await connection.getBalance(A.publicKey, "confirmed")) >= 0.6 * LAMPORTS_PER_SOL;
  if (ok) console.log("A já tem saldo; airdrop pulado");
  for (const sol of ok ? [] : [2, 1, 0.5]) {
    for (let t = 0; t < 3 && !ok; t++) {
      try { await S.airdropDevnet(connection, A.publicKey, sol); ok = true; console.log("airdrop", sol, "SOL ok"); }
      catch (e: any) { console.log("airdrop falhou:", e.codigo ?? e.message); await sleep(4000); }
    }
    if (ok) break;
  }
  assert(ok, "airdrop em A");

  // fundar B e C para pagarem fees
  const sa = S.assinadorKeypair(A), sb = S.assinadorKeypair(B), sc = S.assinadorKeypair(C), se = S.assinadorKeypair(E);
  {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: A.publicKey, blockhash, lastValidBlockHeight }).add(
      SystemProgram.transfer({ fromPubkey: A.publicKey, toPubkey: B.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL }),
      SystemProgram.transfer({ fromPubkey: A.publicKey, toPubkey: C.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL }),
      SystemProgram.transfer({ fromPubkey: A.publicKey, toPubkey: E.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL }),
    );
    const sig = await sa.enviar(tx, connection);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log("ok: B, C e E fundados");
  }

  const cfg = await S.lerProgramConfig(connection);
  console.log("taxa de criação:", Number(cfg.taxaCriacaoLamports) / LAMPORTS_PER_SOL, "SOL");

  // criar multisig 3 membros, threshold 2
  const criado = await S.criarMultisig({ connection, assinador: sa, membros: [A.publicKey, B.publicKey, C.publicKey], threshold: 2, memo: "LigaFi teste" });
  assert(criado.governancaOnChain, "config_authority == null (governança on-chain)");
  assert(criado.threshold === 2 && criado.membros.length === 3, "threshold 2, 3 membros");
  console.log("multisig", criado.multisigPda.toBase58(), "vault", criado.vaultPda.toBase58(), "tx", criado.assinatura);

  // depositar
  await S.depositarNoVault({ connection, assinador: sa, multisigPda: criado.multisigPda, lamports: 0.2 * LAMPORTS_PER_SOL });
  let info = await S.lerMultisig(connection, criado.multisigPda);
  assert(info.saldoVaultLamports >= 0.2 * LAMPORTS_PER_SOL, `vault com 0.2 SOL (${info.saldoVaultLamports})`);

  // propor transferência 0.05 → D com memo
  const prop = await S.proporTransferencia({ connection, assinador: sa, multisigPda: criado.multisigPda, destinatario: D, lamports: 0.05 * LAMPORTS_PER_SOL, descricao: "Coffee break — teste", categoria: "coffee" });
  assert(prop.transactionIndex === 1n, "índice 1");
  let p = await S.lerProposta(connection, criado.multisigPda, 1n);
  assert(p.status === "Active" && p.aprovacoes.length === 1, `Active com 1 aprovação (${p.status}/${p.aprovacoes.length})`);
  assert(p.tipo === "vault" && p.transferencia?.destinatario.equals(D) && p.transferencia.lamports === BigInt(0.05 * LAMPORTS_PER_SOL), "transferência lida da chain");
  assert(S.lerMemoLigaFi(p.memo)?.descricao === "Coffee break — teste" && S.lerMemoLigaFi(p.memo)?.categoria === "coffee", "memo lido da chain");

  // B aprova → Approved
  await S.aprovarProposta({ connection, assinador: sb, multisigPda: criado.multisigPda, transactionIndex: 1n });
  p = await S.lerProposta(connection, criado.multisigPda, 1n);
  assert(p.status === "Approved", `Approved após 2ª assinatura (${p.status})`);

  // A aprovar de novo → erro traduzido
  try { await S.aprovarProposta({ connection, assinador: sa, multisigPda: criado.multisigPda, transactionIndex: 1n }); assert(false, "aprovar duas vezes deveria falhar"); }
  catch (e: any) { assert(e.name === "ErroLigaFi" && typeof e.message === "string" && !/at .*\.js/.test(e.message), `erro traduzido: ${e.codigo} — ${e.message}`); }

  // executar
  const sigExec = await S.executarProposta({ connection, assinador: sa, multisigPda: criado.multisigPda, transactionIndex: 1n });
  console.log("exec tx", sigExec);
  p = await S.lerProposta(connection, criado.multisigPda, 1n);
  assert(p.status === "Executed", "Executed");
  const saldoD = await connection.getBalance(D, "confirmed");
  assert(saldoD === 0.05 * LAMPORTS_PER_SOL, `D recebeu 0.05 SOL (${saldoD})`);

  // troca de signatário: +E −C
  const troca = await S.proporTrocaDeSignatarios({ connection, assinador: sa, multisigPda: criado.multisigPda, adicionar: [E.publicKey], remover: [C.publicKey], memo: "Transição de gestão" });
  assert(troca.transactionIndex === 2n, "índice 2");
  p = await S.lerProposta(connection, criado.multisigPda, 2n);
  assert(p.tipo === "config" && p.acoes?.length === 2 && p.acoes[0].tipo === "AddMember" && p.acoes[1].tipo === "RemoveMember", "ações de config lidas");
  await S.aprovarProposta({ connection, assinador: sb, multisigPda: criado.multisigPda, transactionIndex: 2n });
  await S.executarProposta({ connection, assinador: sa, multisigPda: criado.multisigPda, transactionIndex: 2n });
  info = await S.lerMultisig(connection, criado.multisigPda);
  const chaves = info.membros.map((m) => m.key.toBase58());
  assert(chaves.includes(E.publicKey.toBase58()) && !chaves.includes(C.publicKey.toBase58()) && info.membros.length === 3, "E entrou, C saiu, ainda 3 membros");
  assert(info.governancaOnChain, "governança on-chain preservada após a troca");
  assert(info.multisigPda.equals(criado.multisigPda) && info.vaultPda.equals(criado.vaultPda), "mesmo cofre, mesmo vault");

  // C (removido) tenta propor → erro
  try { await S.proporTransferencia({ connection, assinador: sc, multisigPda: criado.multisigPda, destinatario: D, lamports: 1000, descricao: "x" }); assert(false, "removido não deveria propor"); }
  catch (e: any) { assert(e.name === "ErroLigaFi", `removido bloqueado: ${e.codigo}`); }
  // E (novo) propõe
  const p3 = await S.proporTransferencia({ connection, assinador: se, multisigPda: criado.multisigPda, destinatario: D, lamports: 1000, descricao: "Novo diretor propõe" });
  assert(p3.transactionIndex === 3n, "novo signatário propõe (índice 3)");

  const lista = await S.listarPropostas(connection, criado.multisigPda);
  assert(lista.length === 3 && lista[0].transactionIndex === 3n && lista[2].status === "Executed", "listarPropostas: 3, mais recente primeiro");

  console.log("MULTISIG_TESTE=" + criado.multisigPda.toBase58());
  console.log(process.exitCode ? "TESTS FAILED" : "ALL TESTS PASSED");
}
main().catch((e) => { console.error("ERRO:", e.message ?? e); process.exitCode = 1; });
