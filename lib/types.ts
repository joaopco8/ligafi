export type DiretorId = string;

/** Papel institucional. `conselho` = conselho fiscal, obrigatório acima de R$ 2.000. */
export type Papel = "presidencia" | "tesouraria" | "conselho" | "base";

export interface Diretor {
  id: DiretorId;
  nome: string;
  iniciais: string;
  cargo: string;
  papel: Papel;
  /** Endereço da carteira (fictício, base58). */
  endereco: string;
}

export type TipoMovimento = "entrada" | "saida";

export type Categoria = "anuidade" | "simposio" | "material" | "palestrante" | "coffee" | "outros";

/** Uma assinatura on-chain. `em` é ISO local: "2026-09-03T11:47:00". */
export interface Assinatura {
  diretor: DiretorId;
  em: string;
}

export interface Movimento {
  id: string;
  /** ISO date (YYYY-MM-DD). Formatado apenas na renderização. */
  data: string;
  descricao: string;
  /** Sempre positivo. O sinal vem de `tipo`. */
  valor: number;
  tipo: TipoMovimento;
  categoria: Categoria;
  gestaoId: string;
  /** Diretores que assinaram, com horário. Vazio em entradas. */
  assinaturas: Assinatura[];
  /** Quem propôs a saída. Ausente em entradas. */
  propostoPor?: DiretorId;
  propostoEm?: string;
  /** Assinatura da transação (fictícia no MVP). */
  txHash: string;
  /** Origem de uma entrada, quando houver. */
  origem?: string;
}

export type StatusPagamento = "pendente" | "executado";

/** `resgate` move dinheiro da aplicação para a conta; não é saída do cofre. */
export type NaturezaPagamento = "pagamento" | "resgate";

export interface Pagamento {
  id: string;
  descricao: string;
  detalhe?: string;
  valor: number;
  categoria: Categoria;
  destinatario: string;
  gestaoId: string;
  natureza: NaturezaPagamento;
  propostoPor: DiretorId;
  criadoEm: string;
  assinaturas: Assinatura[];
  status: StatusPagamento;
  executadoEm?: string;
  txHash?: string;
}

export interface Gestao {
  id: string;
  nome: string;
  /** YYYY-MM-DD */
  inicio: string;
  /** YYYY-MM-DD. Ausente na gestão atual. */
  fim?: string;
  /** Exatamente 5 signatários. */
  diretores: DiretorId[];
}

export type StatusTransicao = "pendente" | "concluida";

export interface Transicao {
  id: string;
  gestaoAnteriorId: string;
  nomeNovaGestao: string;
  novosDiretores: Diretor[];
  assinaturas: Assinatura[];
  status: StatusTransicao;
  criadoEm: string;
  concluidaEm?: string;
  gestaoNovaId?: string;
  /** Snapshot capturado no momento da conclusão, para o comparativo. */
  snapshot?: {
    antes: { endereco: string; saldo: number; movimentos: number };
    depois: { endereco: string; saldo: number; movimentos: number };
  };
}

export type StatusAnuidade = "pago" | "pendente";

export interface Membro {
  id: string;
  nome: string;
  status: StatusAnuidade;
  /** YYYY-MM-DD quando pago. */
  pagoEm?: string;
}

/** Parte do caixa aplicada em rendimento. */
export interface Aplicacao {
  valor: number;
  /** YYYY-MM-DD */
  desde: string;
  /** Rendimento mensal (0.009 = 0,9% a.m.). */
  taxaMensal: number;
  /** Data prevista de uso. */
  previstoPara: string;
  finalidade: string;
}

export interface Liga {
  id: string;
  nome: string;
  sigla: string;
  instituicao: string;
  fundadaEm: string;
  /** Saldo herdado antes da primeira gestão registrada. */
  saldoInicial: number;
  /** Endereço público do cofre (multisig). Fictício no MVP. */
  enderecoCofre: string;
  /** Quórum fixo para mudanças de governança (transição de gestão). */
  quorumGovernanca: { necessarias: number; total: number };
  anuidade: number;
}

/** Carteira conectada em /entrar. `demo` = entrou sem carteira. */
export interface Carteira {
  provedor: string;
  nome: string;
  endereco: string;
  rede: "solana" | "demo";
  conectadaEm: string;
}
