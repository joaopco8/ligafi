import type { Assinatura, Diretor, DiretorId, Papel } from "./types";

/** Política de quórum por faixa de valor. Aplicada de verdade em `store.assinar`. */
export interface Faixa {
  id: string;
  label: string;
  /** Limite superior inclusivo em reais. `Infinity` para a última faixa. */
  ate: number;
  assinaturas: number;
  exigeConselho: boolean;
  exemplo: string;
}

export const faixas: Faixa[] = [
  { id: "baixa", label: "até R$ 200", ate: 200, assinaturas: 2, exigeConselho: false, exemplo: "impressões, certificados, pequenos materiais" },
  { id: "media", label: "de R$ 200 a R$ 2.000", ate: 2000, assinaturas: 3, exigeConselho: false, exemplo: "palestrantes, coffee break, camisetas" },
  { id: "alta", label: "acima de R$ 2.000", ate: Infinity, assinaturas: 4, exigeConselho: true, exemplo: "equipamentos, resgates de aplicação" },
];

export const TOTAL_SIGNATARIOS = 5;

export interface Quorum {
  necessarias: number;
  exigeConselho: boolean;
  faixa: Faixa;
}

export function quorumPara(valor: number): Quorum {
  const faixa = faixas.find((f) => valor <= f.ate) ?? faixas[faixas.length - 1];
  return { necessarias: faixa.assinaturas, exigeConselho: faixa.exigeConselho, faixa };
}

export const PAPEL_LABEL: Record<Papel, string> = {
  presidencia: "Presidência",
  tesouraria: "Tesouraria",
  conselho: "Conselho fiscal",
  base: "Diretoria de base",
};

/** Ordem canônica dos 5 assentos de uma gestão. */
export const ASSENTOS: Papel[] = ["presidencia", "tesouraria", "conselho", "base", "base"];

export function temConselho(assinaturas: Assinatura[], diretores: Diretor[]): boolean {
  return assinaturas.some((a) => diretores.find((d) => d.id === a.diretor)?.papel === "conselho");
}

/** Avalia se um conjunto de assinaturas satisfaz o quórum do valor. */
export function quorumAtingido(valor: number, assinaturas: Assinatura[], diretores: Diretor[]): boolean {
  const q = quorumPara(valor);
  if (assinaturas.length < q.necessarias) return false;
  if (q.exigeConselho && !temConselho(assinaturas, diretores)) return false;
  return true;
}

export function conselhoDe(diretores: Diretor[], ids: DiretorId[]): Diretor | undefined {
  return diretores.find((d) => ids.includes(d.id) && d.papel === "conselho");
}
