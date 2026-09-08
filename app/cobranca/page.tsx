import { Suspense } from "react";
import { RequerSignatario } from "@/components/requer-signatario";
import { DEMO_MODE } from "@/lib/solana/config";
import { CobrancaChain } from "./cobranca-chain";
import { CobrancaForm } from "./cobranca-form";

export default function CobrancaPage() {
  return (
    <RequerSignatario titulo="Cobrança">
      <Suspense fallback={null}>{DEMO_MODE ? <CobrancaForm /> : <CobrancaChain />}</Suspense>
    </RequerSignatario>
  );
}
