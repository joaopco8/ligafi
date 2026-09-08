import type { Metadata } from "next";
import { PagamentoView } from "./pagamento-view";

export const metadata: Metadata = { title: "Pagamento" };

export default function PagamentoPage({ params }: { params: { id: string } }) {
  return <PagamentoView id={params.id} />;
}
