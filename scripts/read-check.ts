// Checagem só-leitura em devnet (sem SOL): ProgramConfig + erro traduzido. `npx -y tsx scripts/read-check.ts`
import { Connection, PublicKey } from "@solana/web3.js";
import { lerMultisig, lerProgramConfig } from "../lib/solana/squads";
(async () => {
  const c = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const cfg = await lerProgramConfig(c);
  console.log("ok: ProgramConfig lido — treasury", cfg.treasury.toBase58(), "| taxa de criação", Number(cfg.taxaCriacaoLamports) / 1e9, "SOL");
  try { await lerMultisig(c, PublicKey.default); console.log("FAIL: deveria falhar"); }
  catch (e: any) { console.log("ok: conta inexistente →", e.name, "|", e.message); }
  const alvo = process.argv[2];
  if (alvo) console.log("saldo de", alvo, "=", (await c.getBalance(new PublicKey(alvo))) / 1e9, "SOL");
})();
