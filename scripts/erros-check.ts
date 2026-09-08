// Tradução de erros + pré-checagem de saldo. `npx -y tsx scripts/erros-check.ts`
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { traduzirErro } from "../lib/solana/erros";
import { assinadorKeypair, depositarNoVault } from "../lib/solana/squads";

function assert(cond: unknown, msg: string) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg);
}

const casos: [unknown, string][] = [
  [new Error("WalletSendTransactionError: User rejected the request."), "recusado"],
  [new Error("WalletNotConnectedError"), "carteira_desconectada"],
  [new Error("Transaction simulation failed: Attempt to debit an account but found no record of a prior credit."), "saldo_insuficiente"],
  [new Error("Simulation failed. custom program error: 0x1"), "saldo_insuficiente"],
  [new Error("TransactionExpiredBlockheightExceededError: Signature abc has expired: block height exceeded."), "blockhash_expirado"],
  [new TypeError("fetch failed"), "rpc_indisponivel"],
  [new Error("failed to get recent blockhash: Error: 503 Service Unavailable"), "rpc_indisponivel"],
  [new Error("429 Too Many Requests"), "airdrop_limite"],
  [new Error("Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1774"), "governanca"],
  [new Error("custom program error: 0x1779"), "quorum_nao_atingido"],
  [new Error("custom program error: 0x2000"), "programa"],
  ["algo estranho", "desconhecido"],
];
for (const [e, esperado] of casos) {
  const t = traduzirErro(e);
  const semStack = !/\bat \w+ \(/.test(t.message) && !/Error:/.test(t.message);
  assert(t.codigo === esperado && semStack, `${esperado} ← "${String(e instanceof Error ? e.message : e).slice(0, 50)}" → "${t.message.slice(0, 60)}"`);
}

(async () => {
  const c = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const semSaldo = Keypair.generate();
  try {
    await depositarNoVault({ connection: c, assinador: assinadorKeypair(semSaldo), multisigPda: new PublicKey("CusL1iYb1MeqgmXsDkPRmQ7aL85vGMCYpyq29Fxu6xuK"), lamports: 1 });
    assert(false, "carteira sem saldo deveria falhar antes de assinar");
  } catch (e: any) {
    assert(e.name === "ErroLigaFi" && e.codigo === "saldo_insuficiente", `sem saldo → ${e.codigo}: ${e.message}`);
  }
  console.log(process.exitCode ? "TESTS FAILED" : "ERROS OK");
})();
