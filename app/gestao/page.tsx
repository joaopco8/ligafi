"use client";

import { RequerSignatario } from "@/components/requer-signatario";
import { DEMO_MODE } from "@/lib/solana/config";
import { GestaoChain } from "./gestao-chain";
import { GestaoDemo } from "./gestao-demo";

export default function GestaoPage() {
  return <RequerSignatario titulo="Gestão">{DEMO_MODE ? <GestaoDemo /> : <GestaoChain />}</RequerSignatario>;
}
