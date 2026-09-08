/**
 * Detecção e conexão de carteiras sem SDK.
 *
 * Duas fontes:
 *   1. Wallet Standard (https://github.com/wallet-standard): qualquer carteira
 *      Solana moderna se registra via evento `wallet-standard:register-wallet`.
 *   2. Objetos injetados clássicos: window.phantom.solana, window.solflare.
 *
 * Phantom e Solflare aparecem sempre, mesmo sem estar instaladas.
 * Só carteiras Solana são listadas.
 */

export type Rede = "solana";

export interface CarteiraOpcao {
  id: string;
  nome: string;
  rede: Rede;
  /** Data URI ou URL do ícone. Ausente quando não detectada. */
  icone?: string;
  instalada: boolean;
  instalar: string;
  /** Conecta e devolve o endereço. Só existe quando instalada. */
  conectar?: () => Promise<string>;
}

// --- tipos mínimos dos objetos injetados ---------------------------------

interface ProvedorSolana {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toString(): string } } | void>;
}

interface WalletStandardWallet {
  name: string;
  icon: string;
  chains: readonly string[];
  features: Record<string, unknown>;
  accounts: readonly { address: string }[];
}

interface WalletStandardApi {
  register(...wallets: WalletStandardWallet[]): () => void;
}

declare global {
  interface Window {
    phantom?: { solana?: ProvedorSolana };
    solana?: ProvedorSolana;
    solflare?: ProvedorSolana;
  }
}

// --- padrão ----------------------------------------------------------------

export const PADRAO: Omit<CarteiraOpcao, "instalada" | "conectar">[] = [
  { id: "phantom", nome: "Phantom", rede: "solana", instalar: "https://phantom.app/download" },
  { id: "solflare", nome: "Solflare", rede: "solana", instalar: "https://solflare.com/download" },
];

function idDe(nome: string): string {
  return nome.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function conectarSolana(p: ProvedorSolana): Promise<string> {
  const r = await p.connect();
  const pk = (r && "publicKey" in r && r.publicKey) || p.publicKey;
  if (!pk) throw new Error("A carteira não devolveu uma chave pública.");
  return pk.toString();
}

/** Lê os objetos injetados clássicos. Só roda no cliente. */
export function detectarInjetadas(): CarteiraOpcao[] {
  if (typeof window === "undefined") return [];
  const out: CarteiraOpcao[] = [];

  const phantom = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : undefined);
  if (phantom?.isPhantom) {
    out.push({ ...PADRAO[0], instalada: true, conectar: () => conectarSolana(phantom) });
  }
  const solflare = window.solflare;
  if (solflare?.isSolflare) {
    out.push({ ...PADRAO[1], instalada: true, conectar: () => conectarSolana(solflare) });
  }
  return out;
}

/**
 * Escuta o Wallet Standard. Chama `onWallet` para cada carteira registrada
 * (agora ou depois). Devolve função de limpeza.
 */
export function ouvirWalletStandard(onWallet: (w: CarteiraOpcao) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const api: WalletStandardApi = {
    register: (...wallets) => {
      for (const w of wallets) {
        const connect = (w.features["standard:connect"] as { connect?: () => Promise<{ accounts: { address: string }[] }> } | undefined)
          ?.connect;
        // Só carteiras Solana.
        if (!w.chains.some((c) => c.startsWith("solana:"))) continue;
        onWallet({
          id: idDe(w.name),
          nome: w.name,
          rede: "solana",
          icone: w.icon,
          instalada: true,
          instalar: "",
          conectar: connect
            ? async () => {
                const r = await connect();
                const addr = r?.accounts?.[0]?.address ?? w.accounts?.[0]?.address;
                if (!addr) throw new Error("A carteira não devolveu uma conta.");
                return addr;
              }
            : undefined,
        });
      }
      return () => {};
    },
  };

  const onRegister = (e: Event) => {
    const cb = (e as CustomEvent<(api: WalletStandardApi) => void>).detail;
    if (typeof cb === "function") cb(api);
  };
  window.addEventListener("wallet-standard:register-wallet", onRegister);
  try {
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  } catch {
    /* ambiente sem CustomEvent */
  }
  return () => window.removeEventListener("wallet-standard:register-wallet", onRegister);
}

/** Junta padrão + detectadas, sem duplicar. Padrão primeiro, na ordem. */
export function mesclar(detectadas: CarteiraOpcao[]): CarteiraOpcao[] {
  const porId = new Map<string, CarteiraOpcao>();
  for (const d of detectadas) {
    const atual = porId.get(d.id);
    // Preferir a entrada que tem `conectar`; manter ícone se algum tiver.
    porId.set(d.id, { ...(atual ?? {}), ...d, icone: d.icone ?? atual?.icone, conectar: d.conectar ?? atual?.conectar });
  }
  const lista: CarteiraOpcao[] = PADRAO.map((p) => porId.get(p.id) ?? { ...p, instalada: false });
  for (const [id, w] of Array.from(porId.entries())) if (!PADRAO.some((p) => p.id === id)) lista.push(w);
  return lista;
}

export function truncarEndereco(e: string, n = 4): string {
  return e.length > n * 2 + 1 ? `${e.slice(0, n)}…${e.slice(-n)}` : e;
}
