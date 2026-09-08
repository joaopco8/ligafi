import { Suspense } from "react";
import { CobrancaForm } from "./cobranca-form";

export default function CobrancaPage() {
  return (
    <Suspense fallback={null}>
      <CobrancaForm />
    </Suspense>
  );
}
