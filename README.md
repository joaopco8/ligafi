# LigaFi

Tesouraria transparente para entidades estudantis brasileiras (ligas acadêmicas, atléticas, DAs).

> O caixa da entidade que a próxima gestão herda.

- O caixa pertence à entidade, não ao CPF de um diretor.
- Nenhum pagamento sai sem 3 assinaturas de 5 diretores.
- O extrato é público: link aberto, ninguém precisa de senha.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Telas

| Rota | O que faz |
|------|-----------|
| `/` | Landing com os dois caminhos: extrato público e entrada da diretoria. |
| `/entrar` | Conexão de carteira: detecta Phantom, Solflare, MetaMask e qualquer carteira Wallet Standard; opção de modo demo. |
| `/extrato/lamed` | Extrato público. Timeline de gestões (atual selecionada), resumo do período, 46 movimentos clicáveis. |
| `/painel` | Diretoria. Saldo total, saldo rendendo, pagamentos pendentes com slots de assinatura. |
| `/pagamento/[id]` | Detalhe do pagamento. Botão **Assinar**: ao atingir o quórum da faixa muda para *Executado* e entra no extrato. |
| `/cobranca` | Gera QR Solana Pay (`solana:<cofre>?amount=&label=`) e copia mensagem pronta para o WhatsApp. |
| `/gestao` | Diretoria atual (5 assentos, mandato), transição de gestão (5 novos signatários com nome e endereço, 3 assinaturas da gestão atual) e comparativo antes/depois. |
| `/regras` | Política de quórum por faixa de valor (somente leitura). |
| `/anuidade` | 40 membros, progresso da arrecadação, filtro por status, botão **Cobrar** que abre `/cobranca` pré-preenchida. |

No extrato: timeline horizontal de gestões filtra os movimentos (gestão atual por padrão); cards de entradas, saídas e saldo do período; barra empilhada (só CSS) com as saídas por categoria; tocar num movimento abre drawer (desktop) ou bottom sheet (mobile) com proponente, assinaturas com horário, hash com botão de copiar e link para o Solscan.

No painel: card de rendimento com saldo parado, rendimento acumulado, data prevista de uso e botão **Resgatar**, que cria uma proposta sujeita ao mesmo quórum.

### Quórum

Faixa única: **3 de 5 assinaturas para qualquer valor**, garantida on-chain pelo threshold do multisig (Squads v4). Faixas por valor foram removidas de propósito: a chain só conhece um threshold e qualquer regra extra no front-end seria contornável. Definido em [`lib/regras.ts`](lib/regras.ts).

**Próximo passo (não implementado):** Squads *Spending Limits* para pequenas despesas recorrentes, um teto por período que um diretor gasta sem proposta, também garantido on-chain.

Pagamentos pendentes no mock: `p01` R$ 620 (2/3), `p02` R$ 900 (1/3), `p03` R$ 1.450 (0/3), `p04` R$ 3.200 (2/3), `p05` R$ 150 (1/3).

## Stack

Next.js 14 App Router · TypeScript · Tailwind · Zustand + persist · qrcode.react. Fontes: Outfit (texto) e Host Grotesk (títulos, semibold).

Sem backend, sem banco, sem autenticação. Todos os dados vêm de [`lib/mock-data.ts`](lib/mock-data.ts): 3 gestões (2023–24, 2024–25, 2025–26), 15 diretores com papel e endereço fictício, 46 movimentos com categoria, `gestaoId`, proponente, assinaturas com horário e hash base58 de 88 caracteres, 5 pagamentos pendentes, 40 membros.

O estado (assinaturas, pagamentos executados, resgates, transições) persiste no `localStorage` (chave `ligafi-demo-v3`, `skipHydration` + rehidratação após montar para não quebrar o SSR). O botão **resetar demo** no rodapé de todas as páginas apaga tudo e volta ao mock.

## Estrutura

```
app/
  page.tsx                      landing
  extrato/[ligaId]/             extrato público (SSG + store no cliente)
  painel/                       painel da diretoria
  pagamento/[id]/               assinatura de pagamento
  entrar/                       conexão de carteira (wallet adapter: Phantom, Solflare, Wallet Standard)
  cobranca/                     QR Solana Pay (aceita ?descricao=&valor=)
  gestao/                       transição de gestão + comparativo
  regras/                       política de quórum
  anuidade/                     membros e arrecadação
components/
  ui.tsx                        Card, Botao, Topo, Marca, Rotulo
  assinaturas.tsx               Avatar, SlotsQuorum, Iniciais, LinhaDiretor
  timeline-gestoes.tsx          timeline horizontal (filtro do extrato)
  resumo-extrato.tsx            cards do período + barra de saídas por categoria
  drawer-movimento.tsx          drawer / bottom sheet do movimento
  rendimento-card.tsx           aplicação, rendimento acumulado, Resgatar
  confirmacao.tsx               overlay de check animado
  store-hydration.tsx           rehidrata o persist após montar
  rodape-demo.tsx               botão "resetar demo"
lib/
  types.ts
  mock-data.ts                  liga, 3 gestões, 15 diretores, 46 movimentos, 5 pagamentos, 40 membros
  regras.ts                     faixas de quórum, quorumPara(), quorumAtingido()
  categorias.ts                 rótulos e cores das 6 categorias
  format.ts                     BRL, datas, horas, iniciais
  tx.ts                         hash fictício (88 chars base58) + URL Solscan
  solana/config.ts              RPC devnet via NEXT_PUBLIC_RPC_URL, modo demo, cotação ≈ R$
  store.ts                      Zustand + persist: assinar(), proporResgate(), iniciarTransicao(), assinarTransicao(), reset()
  solana/
    squads.ts                   stubs Squads v4 (criar multisig, propor, aprovar, executar)
    pay.ts                      montarUrlSolanaPay (real) + stubs Helius/Solana Pay
```

## Integração real (próximo passo)

Os arquivos em `lib/solana/` descrevem o fluxo com Squads Protocol v4 e Helius, sem SDK instalado. Quando for implementar:

```bash
npm i @solana/web3.js @sqds/multisig @solana/pay bignumber.js
```

O multisig **é** a entidade: 5 membros, threshold 3, saldo no Vault PDA. Troca de gestão = proposta de configuração (add/remove member), também com 3 de 5. O cofre nunca muda de dono.
