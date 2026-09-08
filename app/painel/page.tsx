"use client";

import { RequerSignatario } from "@/components/requer-signatario";
import { DEMO_MODE } from "@/lib/solana/config";
import { PainelChain } from "./painel-chain";
import { PainelDemo } from "./painel-demo";

export default function PainelPage() {
  return <RequerSignatario>{DEMO_MODE ? <PainelDemo /> : <PainelChain />}</RequerSignatario>;
}
