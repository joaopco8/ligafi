/**
 * Tradução de erros de RPC/carteira/Squads para mensagens humanas em pt-BR.
 * Nunca expõe stack trace na tela; o erro original vai para o console.
 */

export type CodigoErro =
  | "recusado"
  | "carteira_desconectada"
  | "saldo_insuficiente"
  | "blockhash_expirado"
  | "rpc_indisponivel"
  | "airdrop_limite"
  | "quorum_nao_atingido"
  | "governanca"
  | "nao_encontrado"
  | "programa"
  | "desconhecido";

export class ErroLigaFi extends Error {
  constructor(
    message: string,
    public readonly codigo: CodigoErro,
    public readonly original?: unknown,
  ) {
    super(message);
    this.name = "ErroLigaFi";
  }
}

/** Códigos de erro do programa Squads v4 (anchor: 6000 + índice). */
const SQUADS: Record<number, string> = {
  6000: "Assinatura duplicada entre os membros.",
  6001: "Membro vazio.",
  6002: "Número de membros acima do limite.",
  6003: "Threshold inválido para o número de signatários.",
  6004: "Esta carteira não é signatária deste cofre.",
  6005: "Esta carteira não tem permissão para esta ação.",
  6008: "Esta proposta já não está aberta para essa ação.",
  6009: "Você já assinou esta proposta.",
  6010: "Você já rejeitou esta proposta.",
  6011: "Você já cancelou esta proposta.",
  6013: "A proposta ficou obsoleta: uma mudança de configuração aconteceu depois dela.",
  6016: "Threshold inválido para o número de signatários.",
  6023: "Esta proposta ainda não atingiu o quórum.",
  6024: "Esta proposta ainda não atingiu o quórum.",
};

const REGRAS: { re: RegExp; codigo: CodigoErro; msg: string }[] = [
  { re: /user rejected|rejected the request|denied|cancel|4001|closed the (window|popup)|Plugin Closed/i, codigo: "recusado", msg: "Você recusou a assinatura na carteira. Nada foi enviado." },
  { re: /wallet not connected|WalletNotConnected|WalletDisconnected|not connected|disconnected/i, codigo: "carteira_desconectada", msg: "A carteira desconectou no meio da operação. Conecte de novo e tente outra vez." },
  { re: /insufficient (funds|lamports)|custom program error: 0x1\b|Attempt to debit an account but found no record|insufficient funds for rent/i, codigo: "saldo_insuficiente", msg: "Saldo insuficiente em SOL para pagar esta operação. Use o airdrop de devnet e tente de novo." },
  { re: /block ?height exceeded|blockhash not found|has expired|TransactionExpired/i, codigo: "blockhash_expirado", msg: "A transação expirou antes de ser confirmada. Tente de novo." },
  { re: /airdrop.*(limit|rate|dry)|Too Many Requests|faucet/i, codigo: "airdrop_limite", msg: "O faucet de devnet limitou o airdrop por agora. Espere uns minutos ou use https://faucet.solana.com." },
  { re: /failed to fetch|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network ?error|timed? ?out|\b50[234]\b|Service Unavailable|Load failed/i, codigo: "rpc_indisponivel", msg: "A rede devnet não respondeu. Verifique a conexão ou tente mais tarde." },
  { re: /Unable to find account|Account does not exist|could not find account|AccountNotFound/i, codigo: "nao_encontrado", msg: "Multisig não encontrado na devnet. Confira o endereço ou crie o cofre em /setup." },
  { re: /NotAMember|Unauthorized/i, codigo: "governanca", msg: "Esta carteira não é signatária deste cofre." },
  { re: /InvalidProposalStatus|AlreadyApproved|AlreadyRejected/i, codigo: "quorum_nao_atingido", msg: "Esta proposta já foi assinada por você ou não está mais aberta." },
];

function codigoDePrograma(texto: string): number | null {
  const hex = texto.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) return parseInt(hex[1], 16);
  const dec = texto.match(/"Custom":\s*(\d+)/);
  if (dec) return Number(dec[1]);
  return null;
}

export function traduzirErro(e: unknown): ErroLigaFi {
  if (e instanceof ErroLigaFi) return e;
  const texto = e instanceof Error ? `${e.name}: ${e.message}` : typeof e === "string" ? e : JSON.stringify(e);

  for (const r of REGRAS) if (r.re.test(texto)) return new ErroLigaFi(r.msg, r.codigo, e);

  const codigo = codigoDePrograma(texto);
  if (codigo !== null) {
    if (codigo === 1) return new ErroLigaFi(REGRAS[2].msg, "saldo_insuficiente", e);
    const conhecido = SQUADS[codigo];
    if (conhecido) {
      const cod: CodigoErro = codigo === 6004 || codigo === 6005 ? "governanca" : codigo >= 6008 && codigo <= 6024 ? "quorum_nao_atingido" : "programa";
      return new ErroLigaFi(conhecido, cod, e);
    }
    return new ErroLigaFi(`O programa do cofre recusou a operação (código ${codigo}). Recarregue a página e tente de novo.`, "programa", e);
  }
  if (/simulation failed/i.test(texto)) {
    return new ErroLigaFi("A rede recusou a transação na simulação. Recarregue e tente de novo; se persistir, confira o saldo.", "programa", e);
  }
  return new ErroLigaFi("Algo deu errado ao falar com a rede. Tente de novo em instantes.", "desconhecido", e);
}
