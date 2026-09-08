const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatBRL(valor: number): string {
  return brl.format(valor);
}

/** "2026-09-05" -> "05/09/2026". Sem Date() para evitar fuso e hidratação. */
export function formatData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "2026-09-05" -> "05 set". */
export function formatDataCurta(iso: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [, mes, dia] = iso.split("-");
  return `${dia} ${meses[Number(mes) - 1]}`;
}

export function hojeISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Aceita "1.250,50" ou "1250.50" e devolve 1250.5. */
export function parseValorBR(input: string): number {
  const limpo = input.trim().replace(/\s/g, "").replace(/R\$/g, "");
  if (!limpo) return NaN;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  return Number(normalizado);
}

/** ISO local "2026-09-03T11:47:00" -> "11:47". */
export function formatHora(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : "--:--";
}

/** ISO local -> "03/09/2026 às 11:47". */
export function formatDataHora(iso: string): string {
  return `${formatData(iso.slice(0, 10))} às ${formatHora(iso)}`;
}

/** Agora em ISO local, sem fuso: "2026-09-07T21:04:13". */
export function agoraISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** "2024-03-01" -> "mar/24". */
export function formatMesAno(iso: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, mes] = iso.split("-");
  return `${meses[Number(mes) - 1]}/${ano.slice(2)}`;
}

export function formatPeriodo(inicio: string, fim?: string): string {
  return `${formatMesAno(inicio)} – ${fim ? formatMesAno(fim) : "atual"}`;
}

/** "Ana Beatriz Ferreira" -> "AF"; "Lucas" -> "LU". */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "??";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Meses completos entre duas datas ISO (YYYY-MM-DD), sem Date(). */
export function mesesEntre(inicio: string, fim: string): number {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.max(0, meses);
}
