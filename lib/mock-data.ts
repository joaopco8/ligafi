import { PAPEL_LABEL } from "./regras";
import { hashFicticio } from "./tx";
import type {
  Aplicacao,
  Assinatura,
  Categoria,
  Diretor,
  DiretorId,
  Gestao,
  Liga,
  Membro,
  Movimento,
  Pagamento,
  Papel,
  TipoMovimento,
} from "./types";

// ---------------------------------------------------------------------------
// Liga
// ---------------------------------------------------------------------------

export const liga: Liga = {
  id: "lamed",
  nome: "Liga Acadêmica de Medicina de Emergência",
  sigla: "LAMED",
  instituicao: "Faculdade de Medicina",
  fundadaEm: "2023-03-01",
  saldoInicial: 2680,
  enderecoCofre: "LigaFiVau1tLAMED11111111111111111111111111111",
  quorumGovernanca: { necessarias: 3, total: 5 },
  anuidade: 120,
};

export const ligas: Liga[] = [liga];

export const aplicacao: Aplicacao = {
  valor: 5000,
  desde: "2026-03-15",
  taxaMensal: 0.009,
  previstoPara: "2026-11-20",
  finalidade: "IV Simpósio de Emergências",
};

// ---------------------------------------------------------------------------
// Diretores de todas as gestões (5 por gestão)
// ---------------------------------------------------------------------------

/** Endereço fictício base58 de 44 caracteres, determinístico por id. */
export function enderecoFicticio(seed: string): string {
  return hashFicticio(`wallet:${seed}`).slice(0, 44);
}

function dir(id: DiretorId, nome: string, iniciais: string, papel: Papel): Diretor {
  return { id, nome, iniciais, papel, cargo: PAPEL_LABEL[papel], endereco: enderecoFicticio(id) };
}

export const diretores: Diretor[] = [
  // Gestão 2023–24
  dir("pa", "Pedro Henrique Almeida", "PA", "presidencia"),
  dir("gc", "Gabriel Carvalho", "GC", "tesouraria"),
  dir("if", "Isabela Freitas", "IF", "conselho"),
  dir("to", "Thaís Oliveira", "TO", "base"),
  dir("mr", "Matheus Ribeiro", "MR", "base"),
  // Gestão 2024–25
  dir("sa", "Sofia Andrade", "SA", "presidencia"),
  dir("hc", "Helena Castro", "HC", "tesouraria"),
  dir("vp", "Vinícius Pereira", "VP", "conselho"),
  dir("db", "Diego Barbosa", "DB", "base"),
  dir("lt", "Larissa Teixeira", "LT", "base"),
  // Gestão 2025–26 (atual)
  dir("ab", "Ana Beatriz Ferreira", "AB", "presidencia"),
  dir("cr", "Camila Rocha", "CR", "tesouraria"),
  dir("rs", "Rafael Souza", "RS", "conselho"),
  dir("lm", "Lucas Martins", "LM", "base"),
  dir("jn", "Juliana Nogueira", "JN", "base"),
];

// ---------------------------------------------------------------------------
// Gestões (mais antiga primeiro)
// ---------------------------------------------------------------------------

export const gestoes: Gestao[] = [
  { id: "g2324", nome: "Gestão 2023–24", inicio: "2023-03-01", fim: "2024-02-29", diretores: ["pa", "gc", "if", "to", "mr"] },
  { id: "g2425", nome: "Gestão 2024–25", inicio: "2024-03-01", fim: "2025-02-28", diretores: ["sa", "hc", "vp", "db", "lt"] },
  { id: "g2526", nome: "Gestão 2025–26", inicio: "2025-03-01", diretores: ["ab", "cr", "rs", "lm", "jn"] },
];

export const gestaoAtualId = "g2526";

// ---------------------------------------------------------------------------
// Builder de movimentos
// ---------------------------------------------------------------------------

/** Horários fictícios das assinaturas no dia do movimento: proposta, 2ª, 3ª, 4ª. */
const HORAS_ASSINATURA = ["09:12", "11:47", "16:05", "18:30", "20:15"];

export function assinaturasEm(data: string, ids: DiretorId[]): Assinatura[] {
  return ids.map((diretor, i) => ({ diretor, em: `${data}T${HORAS_ASSINATURA[i] ?? "21:00"}:00` }));
}

function mov(
  id: string,
  gestaoId: string,
  data: string,
  tipo: TipoMovimento,
  categoria: Categoria,
  descricao: string,
  valor: number,
  assinantes: DiretorId[] = [],
  origem?: string,
): Movimento {
  const base = { id, gestaoId, data, tipo, categoria, descricao, valor, txHash: hashFicticio(`${id}:${data}:${valor}`) };
  if (tipo === "entrada") {
    return { ...base, assinaturas: [], origem: origem ?? "Cobrança via QR" };
  }
  return {
    ...base,
    assinaturas: assinaturasEm(data, assinantes),
    propostoPor: assinantes[0],
    propostoEm: `${data}T${HORAS_ASSINATURA[0]}:00`,
  };
}

// ---------------------------------------------------------------------------
// Movimentos — 46 ao todo. Toda saída tem 3 assinaturas (threshold do cofre).
// ---------------------------------------------------------------------------

const g2324: Movimento[] = [
  mov("23-01", "g2324", "2023-03-12", "entrada", "anuidade", "Anuidade 2023 — 18 membros", 2160),
  mov("23-02", "g2324", "2023-03-20", "saida", "material", "Material de aula prática — kit de sutura", 420, ["pa", "to", "gc"]),
  mov("23-03", "g2324", "2023-04-08", "saida", "outros", "Camisetas da liga — lote de 30 unidades", 960, ["to", "gc", "mr"]),
  mov("23-04", "g2324", "2023-04-25", "entrada", "simposio", "Inscrições — I Simpósio de Emergências (32 participantes)", 1920),
  mov("23-05", "g2324", "2023-05-10", "saida", "palestrante", "Palestrante — Dra. Renata Campos (honorário)", 700, ["pa", "if", "mr"]),
  mov("23-06", "g2324", "2023-05-10", "saida", "coffee", "Coffee break — I Simpósio de Emergências", 480, ["pa", "to", "if"]),
  mov("23-07", "g2324", "2023-06-14", "saida", "outros", "Taxa de uso do auditório — I Simpósio", 250, ["gc", "if", "mr"]),
  mov("23-08", "g2324", "2023-08-02", "entrada", "outros", "Patrocínio — Livraria Médica", 1000, [], "Transferência"),
  mov("23-09", "g2324", "2023-08-20", "saida", "material", "Manequim de RCP (seminovo)", 850, ["pa", "gc", "if"]),
  mov("23-10", "g2324", "2023-09-05", "entrada", "simposio", "Inscrições — Curso de suturas (12 participantes)", 600),
  mov("23-11", "g2324", "2023-09-18", "saida", "coffee", "Coffee break — curso de suturas", 180, ["to", "gc", "mr"]),
  mov("23-12", "g2324", "2023-10-22", "saida", "palestrante", "Palestrante — Dr. Otávio Lins (honorário)", 600, ["pa", "to", "mr"]),
  mov("23-13", "g2324", "2023-11-15", "entrada", "anuidade", "Anuidade 2023 — 4 membros (2º semestre)", 480),
  mov("23-14", "g2324", "2023-12-06", "saida", "outros", "Impressão de certificados", 90, ["if", "pa", "mr"]),
  mov("23-15", "g2324", "2024-02-10", "saida", "material", "Reposição — luvas e fios de sutura", 210, ["to", "if", "gc"]),
];

const g2425: Movimento[] = [
  mov("24-01", "g2425", "2024-03-10", "entrada", "anuidade", "Anuidade 2024 — 22 membros", 2640),
  mov("24-02", "g2425", "2024-03-28", "saida", "outros", "Camisetas da liga — lote de 35 unidades", 1120, ["sa", "db", "hc"]),
  mov("24-03", "g2425", "2024-04-15", "entrada", "simposio", "Inscrições — II Simpósio de Emergências (40 participantes)", 2800),
  mov("24-04", "g2425", "2024-05-09", "saida", "palestrante", "Palestrante — Dr. Caio Menezes (honorário)", 800, ["sa", "hc", "lt"]),
  mov("24-05", "g2425", "2024-05-09", "saida", "coffee", "Coffee break — II Simpósio (2 dias)", 640, ["db", "vp", "lt"]),
  mov("24-06", "g2425", "2024-05-09", "saida", "outros", "Taxa de uso do auditório — II Simpósio", 300, ["sa", "db", "vp"]),
  mov("24-07", "g2425", "2024-06-20", "saida", "material", "Material — laringoscópio de treino (via aérea)", 1150, ["sa", "hc", "vp"]),
  mov("24-08", "g2425", "2024-08-05", "entrada", "outros", "Patrocínio — Clínica Vida", 1500, [], "Transferência"),
  mov("24-09", "g2425", "2024-08-22", "entrada", "simposio", "Inscrições — Curso de ECG (10 participantes)", 500),
  mov("24-10", "g2425", "2024-09-03", "saida", "coffee", "Coffee break — curso de ECG", 160, ["hc", "vp", "lt"]),
  mov("24-11", "g2425", "2024-09-30", "saida", "palestrante", "Palestrante — Dra. Paula Sant'Anna (honorário)", 650, ["db", "hc", "lt"]),
  mov("24-12", "g2425", "2024-10-17", "saida", "material", "Material — fios de sutura e agulhas", 390, ["sa", "db", "lt"]),
  mov("24-13", "g2425", "2024-11-12", "entrada", "anuidade", "Anuidade 2024 — 3 membros (2º semestre)", 360),
  mov("24-14", "g2425", "2024-12-05", "saida", "outros", "Impressão de certificados e banners", 240, ["vp", "lt", "sa"]),
  mov("24-15", "g2425", "2025-02-18", "saida", "outros", "Confraternização de encerramento da gestão", 380, ["sa", "db", "hc"]),
];

const g2526: Movimento[] = [
  mov("25-01", "g2526", "2025-03-09", "entrada", "anuidade", "Anuidade 2025 — 25 membros", 3000),
  mov("25-02", "g2526", "2025-04-14", "saida", "material", "Material — kit de imobilização", 520, ["ab", "lm", "cr"]),
  mov("25-03", "g2526", "2025-05-22", "saida", "palestrante", "Palestrante — Dr. Bruno Tavares (honorário)", 700, ["cr", "rs", "jn"]),
  mov("25-04", "g2526", "2025-08-01", "entrada", "simposio", "Inscrições — Curso de ECG (8 participantes)", 640),
  mov("25-05", "g2526", "2025-08-05", "saida", "outros", "Impressão de certificados — curso de ECG", 95, ["cr", "lm", "jn"]),
  mov("25-06", "g2526", "2025-08-14", "saida", "outros", "Camisetas da liga — lote de 40 unidades", 1280, ["ab", "lm", "rs"]),
  mov("25-07", "g2526", "2025-08-18", "entrada", "outros", "Patrocínio — Farmácia Escola", 1500, [], "Transferência"),
  mov("25-08", "g2526", "2025-08-25", "saida", "palestrante", "Palestrante — Dr. Henrique Alves (honorário)", 800, ["ab", "cr", "jn"]),
  mov("25-09", "g2526", "2025-10-28", "saida", "outros", "Taxa de uso do auditório — palestra de abertura", 250, ["ab", "cr", "rs"]),
  mov("25-10", "g2526", "2026-03-10", "entrada", "anuidade", "Anuidade 2026 — 24 membros", 2880),
  mov("25-11", "g2526", "2026-08-10", "entrada", "anuidade", "Anuidade 2026 — Beatriz Santos", 120),
  mov("25-12", "g2526", "2026-08-20", "entrada", "anuidade", "Anuidade 2026 — João Pedro Lima", 120),
  mov("25-13", "g2526", "2026-08-28", "saida", "material", "Material de aula prática — fios de sutura e luvas", 486.5, ["cr", "rs", "jn"]),
  mov("25-14", "g2526", "2026-09-01", "entrada", "simposio", "Inscrições — III Simpósio de Emergências (14 participantes)", 1120),
  mov("25-15", "g2526", "2026-09-03", "saida", "coffee", "Coffee break — aula prática de suturas", 340, ["ab", "cr", "lm"]),
  mov("25-16", "g2526", "2026-09-05", "entrada", "anuidade", "Anuidade 2026 — Mariana Costa", 120),
];

/** Mais recente primeiro. */
export const movimentos: Movimento[] = [...g2324, ...g2425, ...g2526].sort((a, b) =>
  a.data === b.data ? b.id.localeCompare(a.id) : b.data.localeCompare(a.data),
);

// ---------------------------------------------------------------------------
// Pagamentos aguardando assinaturas (gestão atual). Quórum único: 3 de 5.
// ---------------------------------------------------------------------------

export const pagamentos: Pagamento[] = [
  {
    id: "p01",
    descricao: "Coffee break — III Simpósio de Emergências",
    detalhe: "Buffet para 60 pessoas, dois intervalos. Orçamento aprovado em reunião de 02/09.",
    valor: 620,
    categoria: "coffee",
    destinatario: "Sabor & Cia Buffet",
    gestaoId: "g2526",
    natureza: "pagamento",
    propostoPor: "ab",
    criadoEm: "2026-09-04",
    assinaturas: assinaturasEm("2026-09-04", ["ab", "cr"]),
    status: "pendente",
  },
  {
    id: "p02",
    descricao: "Palestrante — Dra. Fernanda Lopes",
    detalhe: "Honorário pela palestra “Trauma no pronto-socorro”, 90 minutos.",
    valor: 900,
    categoria: "palestrante",
    destinatario: "Fernanda Lopes",
    gestaoId: "g2526",
    natureza: "pagamento",
    propostoPor: "jn",
    criadoEm: "2026-09-05",
    assinaturas: assinaturasEm("2026-09-05", ["jn"]),
    status: "pendente",
  },
  {
    id: "p03",
    descricao: "Reposição de material — manequim de RCP",
    detalhe: "Substituição do manequim danificado na aula prática de agosto.",
    valor: 1450,
    categoria: "material",
    destinatario: "MedSim Equipamentos",
    gestaoId: "g2526",
    natureza: "pagamento",
    propostoPor: "lm",
    criadoEm: "2026-09-06",
    assinaturas: [],
    status: "pendente",
  },
  {
    id: "p04",
    descricao: "Manequim de simulação avançada",
    detalhe: "Simulador de paciente para treino de via aérea e RCP. Orçamento comparado com dois fornecedores.",
    valor: 3200,
    categoria: "material",
    destinatario: "SimMed Brasil",
    gestaoId: "g2526",
    natureza: "pagamento",
    propostoPor: "ab",
    criadoEm: "2026-09-02",
    assinaturas: assinaturasEm("2026-09-02", ["ab", "lm"]),
    status: "pendente",
  },
  {
    id: "p05",
    descricao: "Impressão de crachás — III Simpósio",
    detalhe: "60 crachás com cordão para o simpósio.",
    valor: 150,
    categoria: "outros",
    destinatario: "Gráfica Rápida",
    gestaoId: "g2526",
    natureza: "pagamento",
    propostoPor: "jn",
    criadoEm: "2026-09-06",
    assinaturas: assinaturasEm("2026-09-06", ["jn"]),
    status: "pendente",
  },
];

// ---------------------------------------------------------------------------
// Membros — anuidade 2026 (40 membros, 27 pagos)
// ---------------------------------------------------------------------------

const NOMES_MEMBROS = [
  "Mariana Costa", "João Pedro Lima", "Beatriz Santos", "Arthur Gonçalves", "Laura Mendes",
  "Enzo Cavalcanti", "Valentina Rocha", "Miguel Barros", "Alice Monteiro", "Davi Fernandes",
  "Helena Prado", "Bernardo Assis", "Manuela Torres", "Heitor Vieira", "Cecília Ramos",
  "Théo Nascimento", "Isadora Pinto", "Lorenzo Farias", "Lívia Correia", "Benício Lopes",
  "Antonella Braga", "Nicolas Duarte", "Melissa Sales", "Samuel Guimarães", "Clara Azevedo",
  "Vicente Moraes", "Maitê Siqueira", "Rafael Antunes", "Júlia Camargo", "Gael Peixoto",
  "Yasmin Batista", "Caio Rezende", "Elisa Machado", "Bento Aragão", "Sophia Cardoso",
  "Otávio Brandão", "Lara Figueiredo", "Ravi Nogueira", "Ana Clara Dias", "Pietro Sampaio",
];

const DATAS_PAGAMENTO = ["2026-09-05", "2026-08-20", "2026-08-10"];

export const membros: Membro[] = NOMES_MEMBROS.map((nome, i) => {
  // Os 3 primeiros batem com as entradas individuais do extrato; os 24 seguintes
  // entraram no lote "Anuidade 2026 — 24 membros" (10/03); os 13 últimos pendentes.
  const id = `m${i + 1}`;
  const endereco = enderecoFicticio(`membro:${id}`);
  if (i < 3) return { id, nome, endereco, status: "pago", pagoEm: DATAS_PAGAMENTO[i] };
  if (i < 27) return { id, nome, endereco, status: "pago", pagoEm: "2026-03-10" };
  return { id, nome, endereco, status: "pendente" };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getLiga(id: string): Liga | undefined {
  return ligas.find((l) => l.id === id);
}

export function getDiretor(id: string): Diretor | undefined {
  return diretores.find((d) => d.id === id);
}

export function calcularSaldo(lista: Movimento[], saldoInicial = liga.saldoInicial): number {
  return lista.reduce(
    (acc, m) => (m.tipo === "entrada" ? acc + m.valor : acc - m.valor),
    saldoInicial,
  );
}

export function idsDe(assinaturas: Assinatura[]): DiretorId[] {
  return assinaturas.map((a) => a.diretor);
}
