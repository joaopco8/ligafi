import type { Metadata } from "next";
import { RequerSignatario } from "@/components/requer-signatario";
import { PagamentoView } from "./pagamento-view";

export const metadata: Metadata = { title: "Pagamento" };

export default function PagamentoPage({ params }: { params: { id: string } }) {
  return (
    <RequerSignatario titulo="Pagamento">
      <PagamentoView id={params.id} />
    </RequerSignatario>
  );
}
