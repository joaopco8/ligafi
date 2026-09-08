import type { Metadata } from "next";
import { RequerSignatario } from "@/components/requer-signatario";
import { DEMO_MODE } from "@/lib/solana/config";
import { PagamentoChain } from "./pagamento-chain";
import { PagamentoView } from "./pagamento-view";

export const metadata: Metadata = { title: "Pagamento" };

export default function PagamentoPage({ params }: { params: { id: string } }) {
  return (
    <RequerSignatario titulo="Pagamento">
      {DEMO_MODE ? <PagamentoView id={params.id} /> : <PagamentoChain id={params.id} />}
    </RequerSignatario>
  );
}
