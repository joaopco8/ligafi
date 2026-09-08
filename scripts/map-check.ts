// Lê um multisig real da devnet e mapeia para o vocabulário das telas. `npx -y tsx scripts/map-check.ts <multisig>`
import { Connection, PublicKey } from "@solana/web3.js";
import { lerMultisig, listarPropostas } from "../lib/solana/squads";
import { mapearProposta } from "../lib/tesouraria/mapear";
(async () => {
  const c = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const pda = new PublicKey(process.argv[2]);
  const info = await lerMultisig(c, pda);
  console.log("multisig ok | threshold", info.threshold, "| membros", info.membros.length, "| governança on-chain", info.governancaOnChain, "| vault SOL", info.saldoVaultLamports / 1e9);
  const props = await listarPropostas(c, pda);
  for (const p of props) {
    const ui = mapearProposta(p, info.threshold, null);
    console.log(`#${ui.id} ${ui.tipo} | ${ui.status} | ${ui.descricao} | ${ui.categoria} | ${ui.valorSol ?? "-"} SOL | aprov ${ui.aprovacoes.length}/${ui.necessarias}${ui.acoes ? " | ações " + ui.acoes.map(a => a.tipo).join(",") : ""}`);
  }
  const ok = props.length === 3 && mapearProposta(props[2], 2, null).status === "executada" && mapearProposta(props[1], 2, null).tipo === "gestao" && mapearProposta(props[2], 2, null).descricao === "Coffee break — teste";
  console.log(ok ? "MAP OK" : "MAP FAIL");
})();
