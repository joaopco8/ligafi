# LigaFi

Tesouraria multi-assinatura para entidades estudantis brasileiras (ligas acadêmicas, atléticas, DAs), em Solana **devnet**.

> O caixa da entidade que a próxima gestão herda.

- O caixa pertence à entidade, não ao CPF de um diretor: o cofre é um multisig **Squads Protocol v4** sem `config_authority` (governança 100% on-chain).
- Nenhum pagamento sai sem o quórum: **3 de 5 assinaturas**, garantido pelo threshold do multisig e verificado pela rede, não pelo app.
- O extrato é público e sobrevive à troca de gestão: a troca de signatários é uma proposta on-chain aprovada pela gestão que sai. O endereço do cofre, o saldo e o histórico não mudam.

## Setup

```bash
npm install
cp .env.example .env.local   # edite conforme abaixo
npm run dev                  # http://localhost:3000
```

### Variáveis (`.env.local`)

| Variável | Padrão | Para quê |
|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `true` | `true` = telas com dados fictícios (plano B para gravação). `false` = on-chain. |
| `NEXT_PUBLIC_RPC_URL` | RPC público de devnet | RPC de devnet. **Use Helius/QuickNode devnet para demo**: o público limita muito (429). Mainnet é recusada. |
| `NEXT_PUBLIC_MULTISIG_ADDRESS` | vazio | Cofre compartilhado. Sem ele, o endereço vem do `localStorage` após `/setup`. |
| `NEXT_PUBLIC_BRL_POR_SOL` | `900` | Cotação fixa só para exibir `≈ R$`. Não é oráculo. |
| `HELIUS_API_KEY` | vazio | Extrato via Helius Enhanced Transactions (fica no servidor). Sem ela, cai em `getSignaturesForAddress`. |
| `NEXT_PUBLIC_HELIUS_API_KEY` | vazio | Alternativa pública da anterior (não recomendada). |

Nenhuma chave privada é lida pelo app. Toda assinatura passa pela carteira (Phantom, Solflare ou qualquer Wallet Standard).

### SOL de devnet

1. Na carteira, selecione a rede **Devnet**.
2. Em `/setup`, botão **Airdrop 1 SOL**. O faucet do RPC público limita por IP e por dia; se recusar, use https://faucet.solana.com (login GitHub) e cole seu endereço.
3. Criar o cofre custa a taxa do programa Squads (0 SOL em devnet) + rent (~0,01 SOL). Cada proposta custa ~0,003 SOL de rent, pago por quem propõe.

### Fluxo on-chain (`NEXT_PUBLIC_DEMO_MODE=false`)

1. `/entrar` → conectar carteira.
2. `/setup` → criar o cofre com 1 a 5 endereços e threshold (padrão 3). O app lê o multisig de volta e só aceita `config_authority = null`. Depositar SOL no vault.
3. `/painel` → **Nova proposta de pagamento** (descrição vai como memo on-chain). A proposta já sai com a 1ª assinatura.
4. `/pagamento/<índice>` → outras carteiras signatárias assinam; ao atingir o threshold, **Executar**.
5. `/extrato/<vault>` → link público, sem carteira, lido da devnet, cada linha com assinatura real e link Solscan.
6. `/cobranca` → QR Solana Pay para o vault com `reference` única; a tela mostra pendente → confirmado.
7. `/gestao` → **Iniciar transição**: 5 novos endereços; a gestão atual assina (3 de 5); executar troca os `members` na chain. Comparativo antes/depois lido da devnet.

Para testar sozinho com uma carteira só: crie o cofre com threshold 1.

## Rotas

| Rota | Modo demo | Modo chain |
|---|---|---|
| `/` | Landing | Landing |
| `/entrar` | Carteiras + modo demo | Carteiras; papel resolvido por `members[]` |
| `/setup` | — | Criar/importar multisig, airdrop, depósito, selo de governança |
| `/painel` | Saldo e pagamentos fictícios | Saldo real do vault, propostas reais, quórum |
| `/pagamento/nova` | — | Proposta real com memo |
| `/pagamento/[id]` | Assinatura simulada | Aprovar / rejeitar / executar assinados pela carteira |
| `/gestao` | Transição simulada | ConfigTransaction real + comparativo |
| `/cobranca` | QR com endereço fictício | Solana Pay real + verificação por reference |
| `/extrato/lamed` | Extrato fictício (3 gestões, 46 movimentos) | Cofre deste navegador |
| `/extrato/<vault>` | Lido da devnet | Lido da devnet (link compartilhável) |
| `/regras` | Quórum 3 de 5, governança on-chain | idem |
| `/anuidade` | 40 membros fictícios | idem (lista continua off-chain) |
| `/api/extrato` | — | Histórico do vault (Helius ou RPC), cache 20 s |
| `/api/cobranca/verificar` | — | Status de uma cobrança pela reference |

Rotas da diretoria (`/painel`, `/pagamento/*`, `/cobranca`, `/gestao`) exigem carteira conectada **e** signatária. `/extrato/*` é sempre público.

## Scripts de verificação (devnet)

```bash
npx tsc --noEmit                                  # typecheck
NEXT_DIST_DIR=.next-verify npm run build          # build sem derrubar o `next dev`
npx -y tsx scripts/read-check.ts                  # leitura: ProgramConfig, erro traduzido
npx -y tsx scripts/erros-check.ts                 # tradução de erros + pré-checagem de saldo
npx -y tsx scripts/map-check.ts <multisig>        # mapeamento Squads → telas
npx -y tsx scripts/historico-check.ts <vault>     # extrato on-chain
SMOKE_KEYPAIR_PATH=/fora/do/repo.json npm run smoke:devnet      # ciclo completo (cria, propõe, aprova, executa, troca gestão)
SMOKE_KEYPAIR_PATH=... npx -y tsx scripts/pay-check.ts <vault>  # Solana Pay ponta a ponta
```

`SMOKE_KEYPAIR_PATH` aponta para um JSON de secret key de **teste**, fora do repositório, com SOL de devnet. Sem ele o smoke tenta airdrop.

## Arquitetura

```
lib/solana/
  config.ts       RPC, modo demo, cotação ≈ R$, assertDevnet()
  squads.ts       Squads v4: criar (config_authority = null), depositar, propor
                  com memo, aprovar/rejeitar, executar, ler multisig/propostas,
                  troca de signatários. Assinador abstrai wallet adapter e Keypair.
  historico.ts    extrato do vault (Helius ou RPC), casado por assinatura
  pay.ts          Solana Pay: URL, reference, verificação, tx de pagamento
  erros.ts        tradução para pt-BR (códigos do Squads incluídos)
lib/tesouraria/
  chain-store.ts  cache + polling do estado on-chain
  mapear.ts       Squads → vocabulário das telas (puro)
  use-acao.tsx    loading / erro humano / carteira caiu no meio
lib/auth.ts       identidade = carteira; papel por members[] (chain) ou mock (demo)
lib/cofre-store.ts  cofre configurado, nomes dos signatários, metadados locais
lib/store.ts        modo demo (Zustand + persist), intocado
app/*/…-chain.tsx   versão on-chain; …-demo.tsx / …-view.tsx versão demo
```

### O que fica on-chain e o que fica no navegador

On-chain: multisig, signatários, threshold, saldo do vault, propostas, aprovações, execuções, descrição+categoria do pagamento (memo), troca de gestão, pagamentos de cobrança (com reference).

No navegador (`localStorage`): nome da entidade, nomes e cargos dos signatários, nomes de destinatários, nomes das gestões, cobranças geradas. São rótulos; a verdade é a chain.

## O que ficou incompleto ou frágil

- **RPC público de devnet** devolve 429 com frequência e batches fora de ordem (tratado). Para vídeo, use um RPC dedicado.
- **Faucet**: o airdrop pelo app depende do limite do RPC público. O botão explica e aponta o faucet oficial.
- **Threshold 3 de 5 é o padrão, não uma imposição**: `/setup` aceita de 1 a N. A UI de `/regras` descreve 3 de 5.
- **Assinantes de cada movimento no extrato** não são reconstruídos a partir da chain (exigiria cruzar cada execução com a Proposal). O drawer mostra a assinatura da transação, o memo e "executada pelo multisig".
- **Anuidade** (`/anuidade`) continua com lista fictícia; a cobrança individual gera Solana Pay real, mas o status "pago" do membro não é atualizado automaticamente.
- **Resgate de aplicação** (card de rendimento) existe só no modo demo: devnet não tem rendimento.
- **Comparativo de transição** depende de metadados salvos no navegador que propôs; em outro navegador aparece só o estado atual da chain.
- **Spending Limits** do Squads (pequenas despesas sem proposta, também on-chain) não implementados. Próximo passo natural.
- **Wallet Standard**: o adapter deduplica Phantom/Solflare quando a extensão também se registra pelo padrão; em navegadores sem extensão a lista mostra "não instalada" com link.

## Stack

Next.js 14 App Router · TypeScript · Tailwind · Zustand · @solana/web3.js 1.98 · @sqds/multisig 2.1 · @solana/wallet-adapter (react, react-ui, phantom, solflare) · qrcode.react. Fontes: Outfit (texto) e Host Grotesk (títulos, semibold).

`@solana/pay` **não** é usada de propósito: a 1.x depende de `@solana/kit`, incompatível com Squads e wallet-adapter em web3.js 1.x. A spec é URL + reference; está implementada em `lib/solana/pay.ts`.
