import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiga, ligas } from "@/lib/mock-data";
import { ExtratoView } from "./extrato-view";

type Props = { params: { ligaId: string } };

export function generateStaticParams() {
  return ligas.map((l) => ({ ligaId: l.id }));
}

export function generateMetadata({ params }: Props): Metadata {
  const liga = getLiga(params.ligaId);
  return { title: liga ? `Extrato · ${liga.sigla}` : "Extrato" };
}

export default function ExtratoPage({ params }: Props) {
  const liga = getLiga(params.ligaId);
  if (!liga) notFound();
  return <ExtratoView liga={liga} />;
}
