// Solana Pay ponta a ponta em devnet: gera cobrança, paga com a chave de
// teste (SMOKE_KEYPAIR_PATH) e verifica pela reference.
// `SMOKE_KEYPAIR_PATH=... npx -y tsx scripts/pay-check.ts <vault>`
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { gerarReference, montarTransacaoPagamento, montarUrlSolanaPay, solParaLamports, verificarCobranca } from "../lib/solana/pay";

function assert(cond: unknown, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; throw new Error(msg); } else console.log("ok:", msg);
}

(async () => {
  const c = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const vault = new PublicKey(process.argv[2]);
  const pagador = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.SMOKE_KEYPAIR_PATH!, "utf8"))));

  const reference = gerarReference();
  const valor = 0.01;
  const url = montarUrlSolanaPay({ destinatario: vault.toBase58(), valor, label: "LAMED", message: "Anuidade 2026 — Teste", reference, memo: "LigaFi:Anuidade 2026 — Teste|anuidade" });
  console.log("url:", url);
  assert(url.startsWith(`solana:${vault.toBase58()}?amount=0.01&reference=${reference}&label=LAMED&message=Anuidade%202026%20%E2%80%94%20Teste&memo=`), "URL no formato da spec (amount decimal, %20, reference)");

  let s = await verificarCobranca(c, { reference, destinatario: vault.toBase58(), lamportsEsperados: solParaLamports(valor) });
  assert(s.status === "pendente", "antes de pagar: pendente");

  const tx = montarTransacaoPagamento({ pagador: pagador.publicKey, destinatario: vault, lamports: solParaLamports(valor), reference: new PublicKey(reference), memo: "LigaFi:Anuidade 2026 — Teste|anuidade" });
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = pagador.publicKey;
  tx.sign(pagador);
  const sig = await c.sendRawTransaction(tx.serialize(), { preflightCommitment: "confirmed" });
  await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  console.log("pago:", sig);

  s = await verificarCobranca(c, { reference, destinatario: vault.toBase58(), lamportsEsperados: solParaLamports(valor) });
  assert(s.status === "confirmado" && s.sig === sig && s.lamportsRecebidos === solParaLamports(valor) && s.pagador === pagador.publicKey.toBase58(), `confirmado pela reference (${s.status}, ${s.lamportsRecebidos})`);

  const menor = await verificarCobranca(c, { reference, destinatario: vault.toBase58(), lamportsEsperados: solParaLamports(valor) * 2 });
  assert(menor.status === "valor_diferente", "esperando o dobro → valor_diferente");

  const outra = await verificarCobranca(c, { reference: gerarReference(), destinatario: vault.toBase58(), lamportsEsperados: 1 });
  assert(outra.status === "pendente", "reference nova → pendente");
  console.log(process.exitCode ? "TESTS FAILED" : "PAY OK");
})().catch((e) => { console.error("ERRO:", e.message ?? e); process.exitCode = 1; });
