import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiga, ligas } from "@/lib/mock-data";
import { DEMO_MODE } from "@/lib/solana/config";
import { ExtratoChain } from "./extrato-chain";
import { ExtratoView } from "./extrato-view";

type Props = { params: { ligaId: string } };

export function generateStaticParams() {
  return ligas.map((l) => ({ ligaId: l.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const liga = getLiga(params.ligaId);
  return { title: liga ? `Extrato · ${liga.sigla}` : "Extrato público" };
}

const PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Público, sem carteira.
 *   - modo demo: /extrato/lamed mostra o mock
 *   - modo chain: /extrato/lamed usa o cofre deste navegador;
 *     /extrato/<vault> é o link compartilhável, lido direto da devnet
 */
export default function ExtratoPage({ params }: Props) {
  const liga = getLiga(params.ligaId);
  if (DEMO_MODE) {
    if (!liga && !PUBKEY.test(params.ligaId)) notFound();
    if (liga) return <ExtratoView liga={liga} />;
    return <ExtratoChain ligaId={params.ligaId} />;
  }
  if (!liga && !PUBKEY.test(params.ligaId)) notFound();
  return <ExtratoChain ligaId={params.ligaId} />;
}
