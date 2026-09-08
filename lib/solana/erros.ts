/**
 * Tradução de erros de RPC/carteira/Squads para mensagens humanas em pt-BR.
 * Nunca expõe stack trace na tela; o erro original vai para o console.
 */

export class ErroLigaFi extends Error {
  constructor(
    message: string,
    public readonly codigo:
      | "recusado"
      | "carteira_desconectada"
      | "saldo_insuficiente"
      | "blockhash_expirado"
      | "rpc_indisponivel"
      | "airdrop_limite"
      | "quorum_nao_atingido"
      | "governanca"
      | "desconhecido",
    public readonly original?: unknown,
  ) {
    super(message);
    this.name = "ErroLigaFi";
  }
}

const REGRAS: { re: RegExp; codigo: ErroLigaFi["codigo"]; msg: string }[] = [
  { re: /user rejected|rejected the request|denied|cancel|4001|closed the (window|popup)/i, codigo: "recusado", msg: "Você recusou a assinatura na carteira. Nada foi enviado." },
  { re: /wallet not connected|WalletNotConnected|not connected|disconnected/i, codigo: "carteira_desconectada", msg: "A carteira desconectou no meio da operação. Conecte de novo e tente outra vez." },
  { re: /insufficient (funds|lamports)|0x1\b|Attempt to debit an account but found no record/i, codigo: "saldo_insuficiente", msg: "Saldo insuficiente em SOL para pagar esta operação. Use o airdrop de devnet e tente de novo." },
  { re: /block ?height exceeded|blockhash not found|expired|TransactionExpired/i, codigo: "blockhash_expirado", msg: "A transação expirou antes de ser confirmada. Tente de novo." },
  { re: /airdrop.*(limit|rate)|429|Too Many Requests|faucet/i, codigo: "airdrop_limite", msg: "O faucet de devnet limitou o airdrop por agora. Espere uns minutos ou use https://faucet.solana.com." },
  { re: /failed to fetch|fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout|503|502|504/i, codigo: "rpc_indisponivel", msg: "A rede devnet não respondeu. Verifique a conexão ou tente mais tarde." },
  { re: /NotAMember|Unauthorized|0x1770/i, codigo: "governanca", msg: "Esta carteira não é signatária deste cofre." },
  { re: /InvalidProposalStatus|AlreadyApproved|0x177b|0x177a/i, codigo: "quorum_nao_atingido", msg: "Esta proposta já foi assinada por você ou não está mais aberta." },
];

export function traduzirErro(e: unknown): ErroLigaFi {
  if (e instanceof ErroLigaFi) return e;
  const texto = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  for (const r of REGRAS) if (r.re.test(texto)) return new ErroLigaFi(r.msg, r.codigo, e);
  return new ErroLigaFi("Algo deu errado ao falar com a rede. Tente de novo em instantes.", "desconhecido", e);
}
