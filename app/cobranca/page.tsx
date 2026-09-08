import { Suspense } from "react";
import { RequerSignatario } from "@/components/requer-signatario";
import { CobrancaForm } from "./cobranca-form";

export default function CobrancaPage() {
  return (
    <RequerSignatario titulo="Cobrança">
      <Suspense fallback={null}>
        <CobrancaForm />
      </Suspense>
    </RequerSignatario>
  );
}
