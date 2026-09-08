import type { Metadata } from "next";
import Link from "next/link";
import { Card, Rotulo } from "@/components/ui";
import { liga } from "@/lib/mock-data";
import { THRESHOLD, TOTAL_SIGNATARIOS } from "@/lib/regras";

export const metadata: Metadata = { title: "Regras de quórum" };

export default function RegrasPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Rotulo>Política de quórum</Rotulo>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">
            {THRESHOLD} de {TOTAL_SIGNATARIOS}, garantido na chain
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {liga.sigla} · uma regra só, para qualquer valor. Não é configuração do app: é o threshold do multisig,
            verificado pelos validadores da rede.
          </p>
        </div>
        <Link href="/painel" className="shrink-0 text-xs font-medium text-white/60 hover:text-white">
          ← Painel
        </Link>
      </header>

      <Card className="mb-4 animate-fadeUp">
        <div className="flex items-center justify-between">
          <Rotulo>Qualquer saída do cofre</Rotulo>
          <span className="inline-flex items-center gap-1">
            {Array.from({ length: TOTAL_SIGNATARIOS }).map((_, j) => (
              <span key={j} aria-hidden className={`h-2.5 w-2.5 rounded-full ${j < THRESHOLD ? "bg-palha" : "border border-white/25"}`} />
            ))}
          </span>
        </div>
        <p className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-palha">
          {THRESHOLD} assinaturas
        </p>
        <p className="mt-1 text-sm text-white/70">
          De uma impressão a um equipamento. Sem faixa por valor, sem exceção, sem regra de front-end que alguém possa
          contornar.
        </p>
      </Card>

      <section className="mb-4 flex flex-col gap-3">
        <Card className="animate-fadeUp" style={{ animationDelay: "60ms" }}>
          <Rotulo>Governança 100% on-chain</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            O multisig é criado sem <code className="text-palha">config_authority</code>. Ninguém, nem quem criou o
            cofre, consegue trocar signatários ou threshold por fora: toda mudança é uma proposta sujeita ao mesmo
            {" "}{THRESHOLD} de {TOTAL_SIGNATARIOS}.
          </p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "100ms" }}>
          <Rotulo>Transição de gestão</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Trocar os {TOTAL_SIGNATARIOS} signatários exige {liga.quorumGovernanca.necessarias} assinaturas da gestão
            que está saindo. O endereço do cofre, o saldo e o histórico não mudam.
          </p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "140ms" }}>
          <Rotulo>Resgates da aplicação</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Tirar dinheiro do rendimento segue a mesma regra. O valor volta para a conta da entidade, mas passa pelo
            mesmo quórum.
          </p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "180ms" }}>
          <Rotulo>Entradas</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Anuidades, inscrições e patrocínios não precisam de assinatura: caem direto no cofre e aparecem no extrato
            público na hora.
          </p>
        </Card>
        <Card className="animate-fadeUp border-white/[0.08]" style={{ animationDelay: "220ms" }}>
          <Rotulo>Próximo passo</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            Pequenas despesas recorrentes (impressão, coffee break) podem virar <em>Spending Limits</em> do Squads:
            um teto por período que um diretor gasta sem proposta, também garantido on-chain. Ainda não implementado.
          </p>
        </Card>
      </section>
    </main>
  );
}
