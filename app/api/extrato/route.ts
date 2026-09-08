import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse, type NextRequest } from "next/server";
import { RPC_URL, assertDevnet } from "@/lib/solana/config";
import { lerHistoricoVault, type PaginaHistorico } from "@/lib/solana/historico";

/**
 * GET /api/extrato?vault=<pubkey>&limite=25&antesDe=<sig>
 *
 * Público, sem carteira. Roda no servidor para:
 *   - manter a chave Helius fora do browser (HELIUS_API_KEY);
 *   - compartilhar cache entre visitantes (TTL curto).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 20_000;
const cache = new Map<string, { em: number; pagina: PaginaHistorico; saldoLamports: number }>();

function chaveHelius(): string | undefined {
  return process.env.HELIUS_API_KEY?.trim() || process.env.NEXT_PUBLIC_HELIUS_API_KEY?.trim() || undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vaultStr = searchParams.get("vault")?.trim();
  const antesDe = searchParams.get("antesDe")?.trim() || undefined;
  const limite = Math.min(Math.max(Number(searchParams.get("limite")) || 25, 1), 100);

  let vault: PublicKey;
  try {
    if (!vaultStr) throw new Error("vault obrigatório");
    vault = new PublicKey(vaultStr);
  } catch {
    return NextResponse.json({ erro: "Endereço do cofre inválido." }, { status: 400 });
  }

  const chave = `${vault.toBase58()}|${antesDe ?? ""}|${limite}`;
  const agora = Date.now();
  const hit = cache.get(chave);
  if (hit && agora - hit.em < TTL_MS) {
    return NextResponse.json({ ...hit.pagina, saldoLamports: hit.saldoLamports, cache: true }, { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } });
  }

  try {
    assertDevnet(RPC_URL);
    const connection = new Connection(RPC_URL, "confirmed");
    const [pagina, saldoLamports] = await Promise.all([
      lerHistoricoVault(connection, vault, { limite, antesDe, heliusApiKey: chaveHelius() }),
      connection.getBalance(vault, "confirmed"),
    ]);
    cache.set(chave, { em: agora, pagina, saldoLamports });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ ...pagina, saldoLamports, cache: false }, { headers: { "cache-control": "public, s-maxage=20, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("[api/extrato]", e);
    const msg = e instanceof Error && /mainnet/i.test(e.message) ? e.message : "A devnet não respondeu. Tente de novo em instantes.";
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
}
