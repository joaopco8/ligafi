import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse, type NextRequest } from "next/server";
import { RPC_URL, assertDevnet } from "@/lib/solana/config";
import { verificarCobranca, type StatusCobranca } from "@/lib/solana/pay";

/**
 * GET /api/cobranca/verificar?reference=<pubkey>&vault=<pubkey>&lamports=<n>
 * Devolve pendente | confirmado | valor_diferente. Cache curto por reference.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 4_000;
const cache = new Map<string, { em: number; r: StatusCobranca }>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get("reference")?.trim() ?? "";
  const vault = searchParams.get("vault")?.trim() ?? "";
  const lamports = Number(searchParams.get("lamports"));
  try {
    new PublicKey(reference);
    new PublicKey(vault);
    if (!(lamports > 0)) throw new Error("lamports");
  } catch {
    return NextResponse.json({ erro: "Parâmetros inválidos." }, { status: 400 });
  }

  const chave = `${reference}|${vault}|${lamports}`;
  const hit = cache.get(chave);
  if (hit && (Date.now() - hit.em < TTL_MS || hit.r.status === "confirmado")) {
    return NextResponse.json({ ...hit.r, cache: true });
  }
  try {
    assertDevnet(RPC_URL);
    const r = await verificarCobranca(new Connection(RPC_URL, "confirmed"), { reference, destinatario: vault, lamportsEsperados: lamports });
    cache.set(chave, { em: Date.now(), r });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ ...r, cache: false });
  } catch (e) {
    console.error("[api/cobranca/verificar]", e);
    return NextResponse.json({ erro: "A devnet não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
}
