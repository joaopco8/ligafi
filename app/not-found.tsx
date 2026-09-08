import { BotaoLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.01em]">Página não encontrada</h1>
      <p className="mt-2 text-sm text-white/60">
        Esse link não existe. Confira o endereço ou volte para o início.
      </p>
      <div className="mt-6">
        <BotaoLink href="/">Voltar ao início</BotaoLink>
      </div>
    </main>
  );
}
