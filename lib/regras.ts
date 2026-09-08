import type { Assinatura, Diretor, DiretorId, Papel } from "./types";

/**
 * Política de quórum. Faixa única: 3 de 5, garantida on-chain pelo
 * threshold do multisig (Squads v4). Faixas por valor (2 e 4 assinaturas)
 * foram removidas: a chain só conhece um threshold e qualquer regra extra
 * no front-end seria contornável. Próximo passo: Spending Limits do Squads
 * para pequenas despesas sem proposta (ver README).
 */

export const TOTAL_SIGNATARIOS = 5;
export const THRESHOLD = 3;

export interface Faixa {
  id: string;
  label: string;
  ate: number;
  assinaturas: number;
  exigeConselho: boolean;
  exemplo: string;
}

export const faixas: Faixa[] = [
  {
    id: "unica",
    label: "qualquer valor",
    ate: Infinity,
    assinaturas: THRESHOLD,
    exigeConselho: false,
    exemplo: "de uma impressão a um equipamento: sempre 3 de 5",
  },
];

export interface Quorum {
  necessarias: number;
  exigeConselho: boolean;
  faixa: Faixa;
}

/** Mantém a assinatura antiga; o valor não muda o quórum. */
export function quorumPara(_valor: number): Quorum {
  return { necessarias: THRESHOLD, exigeConselho: false, faixa: faixas[0] };
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

/** Avalia se um conjunto de assinaturas satisfaz o quórum. */
export function quorumAtingido(valor: number, assinaturas: Assinatura[], _diretores: Diretor[]): boolean {
  return assinaturas.length >= quorumPara(valor).necessarias;
}

export function conselhoDe(diretores: Diretor[], ids: DiretorId[]): Diretor | undefined {
  return diretores.find((d) => ids.includes(d.id) && d.papel === "conselho");
}
