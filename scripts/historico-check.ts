// Lê o histórico real de um vault na devnet. `npx -y tsx scripts/historico-check.ts <vault>`
import { Connection, PublicKey } from "@solana/web3.js";
import { lerHistoricoVault } from "../lib/solana/historico";

(async () => {
  const c = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const vault = new PublicKey(process.argv[2]);
  const pag = await lerHistoricoVault(c, vault, { limite: 25, heliusApiKey: process.env.HELIUS_API_KEY });
  console.log("fonte:", pag.fonte, "| movimentos:", pag.movimentos.length, "| cursor:", pag.proximoCursor ? "sim" : "não");
  for (const m of pag.movimentos) {
    console.log(`${m.tipo.padEnd(7)} ${(m.lamports / 1e9).toFixed(4)} SOL | ${m.descricao} [${m.categoria}] | ${m.contraparte?.slice(0, 6) ?? "-"} | multisig=${m.viaMultisig} | ${m.sig.slice(0, 8)}…`);
  }
  const saida = pag.movimentos.find((m) => m.tipo === "saida");
  const entrada = pag.movimentos.find((m) => m.tipo === "entrada");
  const ok = !!saida && saida.viaMultisig && saida.descricao === "Coffee break — teste" && saida.categoria === "coffee" && saida.lamports === 50_000_000 && !!entrada && entrada.lamports === 200_000_000;
  console.log(ok ? "HISTORICO OK" : "HISTORICO FAIL");
})();
