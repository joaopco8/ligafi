"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { agoraISO, hojeISO, iniciaisDe } from "./format";
import {
  aplicacao as aplicacaoInicial,
  calcularSaldo,
  diretores as diretoresIniciais,
  gestaoAtualId as gestaoAtualInicial,
  gestoes as gestoesIniciais,
  liga,
  movimentos as movimentosIniciais,
  pagamentos as pagamentosIniciais,
} from "./mock-data";
import { ASSENTOS, PAPEL_LABEL, quorumAtingido } from "./regras";
import { hashFicticio } from "./tx";
import type { Aplicacao, Carteira, Diretor, DiretorId, Gestao, Movimento, Pagamento, Transicao } from "./types";

interface DadosPersistidos {
  movimentos: Movimento[];
  pagamentos: Pagamento[];
  gestoes: Gestao[];
  gestaoAtualId: string;
  diretores: Diretor[];
  aplicacao: Aplicacao;
  transicao: Transicao | null;
  ultimaTransicao: Transicao | null;
  /** Diretor que está usando o painel. Sem login no MVP; escolhido na tela. */
  diretorAtual: DiretorId;
  carteira: Carteira | null;
}

export type NovoSignatario = { nome: string; endereco: string };

interface LigaFiState extends DadosPersistidos {
  /** true depois que o localStorage foi lido. */
  hidratado: boolean;

  setDiretorAtual: (id: DiretorId) => void;
  conectarCarteira: (c: Omit<Carteira, "conectadaEm">) => void;
  desconectarCarteira: () => void;
  /**
   * Registra a assinatura de `diretor` no pagamento `id`.
   * Ao atingir o quórum da faixa de valor (ver lib/regras.ts), executa:
   * muda status e, se for pagamento, insere a saída no extrato.
   * Retorna o novo status ou null se nada mudou.
   */
  assinar: (id: string, diretor: DiretorId) => Pagamento["status"] | null;
  criarPagamento: (
    dados: Pick<Pagamento, "descricao" | "valor" | "destinatario" | "detalhe" | "categoria"> &
      Partial<Pick<Pagamento, "natureza">>,
  ) => Pagamento;
  /** Cria proposta de resgate da aplicação, sujeita ao mesmo quórum. */
  proporResgate: (valor: number) => Pagamento | null;

  /** Abre uma transição de gestão. Exige 5 novos signatários na ordem dos assentos. */
  iniciarTransicao: (nomeNovaGestao: string, novos: NovoSignatario[]) => Transicao;
  /** Assinatura de um diretor da gestão atual. Na 3ª, efetiva a troca. */
  assinarTransicao: (diretor: DiretorId) => Transicao["status"] | null;
  cancelarTransicao: () => void;

  reset: () => void;
}

function estadoInicial(): DadosPersistidos {
  return {
    movimentos: movimentosIniciais,
    pagamentos: pagamentosIniciais,
    gestoes: gestoesIniciais,
    gestaoAtualId: gestaoAtualInicial,
    diretores: diretoresIniciais,
    aplicacao: aplicacaoInicial,
    transicao: null,
    ultimaTransicao: null,
    diretorAtual: "rs",
    carteira: null,
  };
}

export const useLigaFi = create<LigaFiState>()(
  persist(
    (set, get) => ({
      ...estadoInicial(),
      hidratado: false,

      setDiretorAtual: (id) => set({ diretorAtual: id }),
      conectarCarteira: (c) => set({ carteira: { ...c, conectadaEm: agoraISO() } }),
      desconectarCarteira: () => set({ carteira: null }),

      assinar: (id, diretor) => {
        const { pagamentos, movimentos, diretores, aplicacao } = get();
        const alvo = pagamentos.find((p) => p.id === id);
        if (!alvo || alvo.status !== "pendente" || alvo.assinaturas.some((a) => a.diretor === diretor)) {
          return null;
        }

        const agora = agoraISO();
        const assinaturas = [...alvo.assinaturas, { diretor, em: agora }];
        const atingiu = quorumAtingido(alvo.valor, assinaturas, diretores);
        const hoje = hojeISO();

        if (!atingiu) {
          set({ pagamentos: pagamentos.map((p) => (p.id === id ? { ...alvo, assinaturas } : p)) });
          return "pendente";
        }

        const txHash = hashFicticio(`exec:${alvo.id}:${agora}`);
        const executado: Pagamento = { ...alvo, assinaturas, status: "executado", executadoEm: hoje, txHash };

        if (alvo.natureza === "resgate") {
          // Resgate: sai da aplicação, entra na conta. Saldo total não muda.
          set({
            pagamentos: pagamentos.map((p) => (p.id === id ? executado : p)),
            aplicacao: { ...aplicacao, valor: Math.max(0, aplicacao.valor - alvo.valor) },
          });
          return "executado";
        }

        const movimento: Movimento = {
          id: `mov-${alvo.id}`,
          data: hoje,
          descricao: alvo.descricao,
          valor: alvo.valor,
          tipo: "saida",
          categoria: alvo.categoria,
          gestaoId: alvo.gestaoId,
          assinaturas,
          propostoPor: alvo.propostoPor,
          propostoEm: `${alvo.criadoEm}T09:12:00`,
          txHash,
        };

        set({
          pagamentos: pagamentos.map((p) => (p.id === id ? executado : p)),
          movimentos: [movimento, ...movimentos],
        });
        return "executado";
      },

      criarPagamento: (dados) => {
        const { pagamentos, gestaoAtualId, diretorAtual } = get();
        const novo: Pagamento = {
          id: `p${String(pagamentos.length + 1).padStart(2, "0")}-${Date.now().toString(36)}`,
          gestaoId: gestaoAtualId,
          natureza: "pagamento",
          propostoPor: diretorAtual,
          criadoEm: hojeISO(),
          assinaturas: [],
          status: "pendente",
          ...dados,
        };
        set({ pagamentos: [novo, ...pagamentos] });
        return novo;
      },

      proporResgate: (valor) => {
        const { aplicacao, pagamentos } = get();
        const emAberto = pagamentos
          .filter((p) => p.natureza === "resgate" && p.status === "pendente")
          .reduce((a, p) => a + p.valor, 0);
        if (!(valor > 0) || valor + emAberto > aplicacao.valor) return null;
        return get().criarPagamento({
          descricao: `Resgate da aplicação — ${aplicacao.finalidade}`,
          detalhe: `Transfere ${valor === aplicacao.valor ? "o total" : "parte"} do saldo aplicado para a conta corrente da entidade. Não sai do cofre.`,
          valor,
          categoria: "outros",
          destinatario: "Conta corrente da entidade",
          natureza: "resgate",
        });
      },

      iniciarTransicao: (nomeNovaGestao, novos) => {
        const { gestaoAtualId } = get();
        const stamp = Date.now();
        const transicao: Transicao = {
          id: `t-${stamp}`,
          gestaoAnteriorId: gestaoAtualId,
          nomeNovaGestao: nomeNovaGestao.trim() || "Nova gestão",
          novosDiretores: novos.slice(0, 5).map((d, i) => {
            const papel = ASSENTOS[i];
            return {
              id: `d-${stamp}-${i}`,
              nome: d.nome.trim(),
              iniciais: iniciaisDe(d.nome),
              papel,
              cargo: PAPEL_LABEL[papel],
              endereco: d.endereco.trim(),
            };
          }),
          assinaturas: [],
          status: "pendente",
          criadoEm: agoraISO(),
        };
        set({ transicao });
        return transicao;
      },

      assinarTransicao: (diretor) => {
        const s = get();
        const t = s.transicao;
        const gestaoAtual = s.gestoes.find((g) => g.id === s.gestaoAtualId);
        if (!t || t.status !== "pendente" || !gestaoAtual) return null;
        if (!gestaoAtual.diretores.includes(diretor)) return null;
        if (t.assinaturas.some((a) => a.diretor === diretor)) return null;

        const agora = agoraISO();
        const assinaturas = [...t.assinaturas, { diretor, em: agora }];

        if (assinaturas.length < liga.quorumGovernanca.necessarias) {
          set({ transicao: { ...t, assinaturas } });
          return "pendente";
        }

        // Efetiva: nova gestão, mesmos cofre/saldo/histórico.
        const hoje = hojeISO();
        const novaGestao: Gestao = {
          id: `g-${Date.now()}`,
          nome: t.nomeNovaGestao,
          inicio: hoje,
          diretores: t.novosDiretores.map((d) => d.id),
        };
        const saldo = calcularSaldo(s.movimentos);
        const antes = { endereco: liga.enderecoCofre, saldo, movimentos: s.movimentos.length };

        const concluida: Transicao = {
          ...t,
          assinaturas,
          status: "concluida",
          concluidaEm: agora,
          gestaoNovaId: novaGestao.id,
          // Capturado após a troca: idêntico por construção — é o ponto.
          snapshot: { antes, depois: { ...antes } },
        };

        set({
          gestoes: [
            ...s.gestoes.map((g) => (g.id === gestaoAtual.id ? { ...g, fim: hoje } : g)),
            novaGestao,
          ],
          gestaoAtualId: novaGestao.id,
          diretores: [...s.diretores, ...t.novosDiretores],
          diretorAtual: novaGestao.diretores[0],
          transicao: null,
          ultimaTransicao: concluida,
        });
        return "concluida";
      },

      cancelarTransicao: () => set({ transicao: null }),

      reset: () => {
        useLigaFi.persist?.clearStorage();
        set({ ...estadoInicial(), hidratado: true });
      },
    }),
    {
      name: "ligafi-demo-v3",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Evita mismatch de hidratação: SSR renderiza o mock, o cliente
      // rehidrata depois de montar (ver components/store-hydration.tsx).
      skipHydration: true,
      partialize: (s): DadosPersistidos => ({
        movimentos: s.movimentos,
        pagamentos: s.pagamentos,
        gestoes: s.gestoes,
        gestaoAtualId: s.gestaoAtualId,
        diretores: s.diretores,
        aplicacao: s.aplicacao,
        transicao: s.transicao,
        ultimaTransicao: s.ultimaTransicao,
        diretorAtual: s.diretorAtual,
        carteira: s.carteira,
      }),
      migrate: (persisted, version) => (version === 3 ? (persisted as DadosPersistidos) : estadoInicial()),
      onRehydrateStorage: () => () => {
        useLigaFi.setState({ hidratado: true });
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useGestaoAtual(): Gestao {
  return useLigaFi((s) => s.gestoes.find((g) => g.id === s.gestaoAtualId) ?? s.gestoes[s.gestoes.length - 1]);
}

export function useDiretor(id: DiretorId | undefined): Diretor | undefined {
  return useLigaFi((s) => (id ? s.diretores.find((d) => d.id === id) : undefined));
}

export function useDiretoresAtuais(): Diretor[] {
  const gestao = useGestaoAtual();
  const todos = useLigaFi((s) => s.diretores);
  return gestao.diretores.map((id) => todos.find((d) => d.id === id)).filter((d): d is Diretor => !!d);
}
