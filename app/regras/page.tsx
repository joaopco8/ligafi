import type { Metadata } from "next";
import Link from "next/link";
import { Card, Marca, Rotulo } from "@/components/ui";
import { liga } from "@/lib/mock-data";
import { TOTAL_SIGNATARIOS, faixas } from "@/lib/regras";

export const metadata: Metadata = { title: "Regras de quórum" };

export default function RegrasPage() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-5 flex items-center justify-between">
        <Marca />
        <Link href="/painel" className="text-xs font-medium text-white/60 hover:text-white">
          ← Painel
        </Link>
      </div>

      <header className="mb-4">
        <Rotulo>Política de quórum</Rotulo>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">Quantas assinaturas cada saída exige</h1>
        <p className="mt-1 text-sm text-white/60">
          {liga.sigla} · {TOTAL_SIGNATARIOS} signatários por gestão. A regra é aplicada na criação de cada pagamento e
          verificada a cada assinatura.
        </p>
      </header>

      <Card className="mb-4 p-0 animate-fadeUp">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wider text-white/50">
              <th scope="col" className="px-4 py-3 font-semibold">
                Valor
              </th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">
                Assinaturas
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Condição
              </th>
            </tr>
          </thead>
          <tbody>
            {faixas.map((f, i) => (
              <tr key={f.id} className="border-b border-white/[0.06] last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {f.label}
                </th>
                <td className="px-2 py-3 text-center">
                  <span className="inline-flex items-center gap-1">
                    {Array.from({ length: TOTAL_SIGNATARIOS }).map((_, j) => (
                      <span
                        key={j}
                        aria-hidden
                        className={`h-2.5 w-2.5 rounded-full ${j < f.assinaturas ? "bg-palha" : "border border-white/25"}`}
                      />
                    ))}
                    <span className="tabular ml-1 font-medium text-palha">{f.assinaturas}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/70">
                  {f.exigeConselho ? (
                    <span className="font-semibold text-palha">Conselho fiscal obrigatório</span>
                  ) : (
                    <span>Quaisquer {f.assinaturas} dos {TOTAL_SIGNATARIOS}</span>
                  )}
                  <span className="mt-0.5 block text-white/45">{f.exemplo}</span>
                  {i === faixas.length - 1 && <span className="sr-only">Faixa mais alta</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <section className="mb-4 flex flex-col gap-3">
        <Card className="animate-fadeUp" style={{ animationDelay: "60ms" }}>
          <Rotulo>Conselho fiscal</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Um dos {TOTAL_SIGNATARIOS} assentos de cada gestão é o conselho fiscal. Acima de R$ 2.000, a proposta
            não executa sem a assinatura dele, mesmo que os outros quatro já tenham assinado.
          </p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "100ms" }}>
          <Rotulo>Resgates da aplicação</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Tirar dinheiro do rendimento segue a mesma tabela. O valor volta para a conta da entidade, não sai do
            cofre, mas passa pelo mesmo quórum.
          </p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "140ms" }}>
          <Rotulo>Transição de gestão</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Trocar os {TOTAL_SIGNATARIOS} signatários exige {liga.quorumGovernanca.necessarias} assinaturas da gestão
            que está saindo. O endereço do cofre, o saldo e o histórico não mudam.
          </p>
        </Card>
        <Card className="animate-fadeUp" style={{ animationDelay: "180ms" }}>
          <Rotulo>Entradas</Rotulo>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            Anuidades, inscrições e patrocínios não precisam de assinatura: caem direto no cofre e aparecem no extrato
            público na hora.
          </p>
        </Card>
      </section>

      <p className="mt-auto pt-4 text-center text-[11px] text-white/40">
        Na versão real, essas faixas viram <em>spending limits</em> e thresholds do multisig, verificados pela rede.
      </p>
    </main>
  );
}
