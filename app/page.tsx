import { BotaoLink } from "@/components/ui";
import { liga } from "@/lib/mock-data";

const pilares = [
  {
    titulo: "Caixa da entidade",
    texto: "O dinheiro fica num cofre da liga, não na conta pessoal de um diretor.",
  },
  {
    titulo: "3 de 5 assinaturas",
    texto: "Nenhum pagamento sai sem três diretores assinarem. Regra garantida pela rede, não pelo app.",
  },
  {
    titulo: "Extrato público",
    texto: "Qualquer membro abre o link e vê cada centavo. Sem senha.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="animate-fadeUp">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-palha/90">
          Tesouraria para ligas, atléticas e DAs
        </p>
        <h1 className="font-display text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.75rem]">
          O caixa da entidade que a próxima gestão herda.
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/65">
          Cofre coletivo, pagamentos com múltiplas assinaturas e extrato aberto para todo mundo.
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-2 animate-fadeUp" style={{ animationDelay: "80ms" }}>
        <BotaoLink href={`/extrato/${liga.id}`}>Ver extrato público</BotaoLink>
        <BotaoLink href="/entrar" variante="secondary">
          Entrar como diretoria
        </BotaoLink>
      </div>

      <ul className="mt-10 grid gap-3 animate-fadeUp" style={{ animationDelay: "160ms" }}>
        {pilares.map((p, i) => (
          <li key={p.titulo} className="flex gap-3 rounded-2xl border border-mata-border/60 bg-mata-card p-4">
            <span className="tabular mt-0.5 text-sm font-medium text-palha">0{i + 1}</span>
            <div>
              <p className="font-display font-semibold">{p.titulo}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-white/60">{p.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
