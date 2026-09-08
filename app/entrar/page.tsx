"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LinhaDiretor } from "@/components/assinaturas";
import { Botao, BotaoLink, Card, Marca, Rotulo } from "@/components/ui";
import { liga } from "@/lib/mock-data";
import { useDiretor, useGestaoAtual, useLigaFi } from "@/lib/store";
import { detectarInjetadas, mesclar, ouvirWalletStandard, truncarEndereco, type CarteiraOpcao } from "@/lib/wallets";

const CORES: Record<string, string> = {
  phantom: "#AB9FF2",
  solflare: "#FC7227",
};

export default function EntrarPage() {
  const router = useRouter();
  const carteira = useLigaFi((s) => s.carteira);
  const diretores = useLigaFi((s) => s.diretores);
  const diretorAtual = useLigaFi((s) => s.diretorAtual);
  const conectarCarteira = useLigaFi((s) => s.conectarCarteira);
  const desconectarCarteira = useLigaFi((s) => s.desconectarCarteira);
  const gestaoAtual = useGestaoAtual();
  const diretor = useDiretor(diretorAtual);

  const [opcoes, setOpcoes] = useState<CarteiraOpcao[]>(() => mesclar([]));
  const [conectando, setConectando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [varredura, setVarredura] = useState(false);

  // Detecta injetadas + Wallet Standard após montar (só existe no cliente).
  useEffect(() => {
    const encontradas = new Map<string, CarteiraOpcao>();
    const aplicar = () => setOpcoes(mesclar(Array.from(encontradas.values())));
    for (const w of detectarInjetadas()) encontradas.set(w.id, w);
    aplicar();
    const parar = ouvirWalletStandard((w) => {
      const atual = encontradas.get(w.id);
      encontradas.set(w.id, { ...atual, ...w, conectar: w.conectar ?? atual?.conectar });
      aplicar();
    });
    // Algumas extensões injetam com atraso.
    const t = setTimeout(() => {
      for (const w of detectarInjetadas()) if (!encontradas.has(w.id)) encontradas.set(w.id, w);
      aplicar();
      setVarredura(true);
    }, 600);
    return () => {
      clearTimeout(t);
      parar();
    };
  }, []);

  async function conectar(o: CarteiraOpcao) {
    if (!o.conectar) return;
    setErro(null);
    setConectando(o.id);
    try {
      const endereco = await o.conectar();
      conectarCarteira({ provedor: o.id, nome: o.nome, endereco, rede: o.rede });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(/reject|denied|cancel|4001/i.test(msg) ? "Conexão recusada na carteira." : msg);
    } finally {
      setConectando(null);
    }
  }

  function entrarDemo() {
    conectarCarteira({ provedor: "demo", nome: "Modo demo", endereco: "", rede: "demo" });
    router.push("/painel");
  }

  const signatario = carteira ? diretores.find((d) => d.endereco === carteira.endereco) : undefined;
  const instaladas = opcoes.filter((o) => o.instalada).length;

  return (
    <main className="flex flex-1 flex-col">
      <div className="mb-6 flex items-center justify-between">
        <Marca />
        <Link href="/" className="text-xs font-medium text-white/55 hover:text-white">
          ← Início
        </Link>
      </div>

      <header className="mb-5">
        <Rotulo>Diretoria · {liga.sigla}</Rotulo>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.01em]">Entrar com a carteira</h1>
        <p className="mt-1 text-sm text-white/55">
          Cada diretor assina com a própria carteira. Nada de senha compartilhada.
        </p>
      </header>

      {carteira && carteira.rede !== "demo" ? (
        <Card className="mb-4 animate-fadeUp border-entrada/40">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Rotulo>Conectada</Rotulo>
              <p className="mt-0.5 font-display font-semibold">{carteira.nome}</p>
              <code className="tabular text-xs text-white/60">{truncarEndereco(carteira.endereco, 6)}</code>
            </div>
            <button type="button" onClick={desconectarCarteira} className="text-xs text-white/45 hover:text-saida">
              desconectar
            </button>
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4 text-sm">
            {signatario ? (
              <>
                <p className="text-entrada">Carteira reconhecida como signatária da {gestaoAtual.nome}.</p>
                <ul className="mt-2">
                  <LinhaDiretor diretor={signatario.id} />
                </ul>
              </>
            ) : (
              <>
                <p className="text-white/70">
                  Esta carteira não é signatária da {gestaoAtual.nome}. No MVP você continua em modo demo, assinando
                  como:
                </p>
                {diretor && (
                  <ul className="mt-2">
                    <LinhaDiretor diretor={diretor.id} />
                  </ul>
                )}
              </>
            )}
          </div>
          <BotaoLink href="/painel" className="mt-4 w-full">
            Ir para o painel
          </BotaoLink>
        </Card>
      ) : (
        <>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <Rotulo>Carteiras</Rotulo>
            <span className="text-xs text-white/40" aria-live="polite">
              {varredura ? (instaladas > 0 ? `${instaladas} detectada${instaladas > 1 ? "s" : ""}` : "nenhuma detectada") : "procurando…"}
            </span>
          </div>
          <ul className="mb-3 flex flex-col gap-2">
            {opcoes.map((o, i) => {
              const ocupado = conectando === o.id;
              return (
                <li key={o.id} className="animate-fadeUp" style={{ animationDelay: `${i * 40}ms` }}>
                  <Card className="flex items-center gap-3 p-3">
                    <IconeCarteira opcao={o} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-tight">{o.nome}</p>
                      <p className="text-[11px] text-white/45">
                        Solana ·{" "}
                        {o.instalada ? <span className="text-entrada">detectada</span> : "não instalada"}
                      </p>
                    </div>
                    {o.instalada && o.conectar ? (
                      <Botao className="px-4 py-2 text-sm" onClick={() => conectar(o)} disabled={!!conectando}>
                        {ocupado ? "Abrindo…" : "Conectar"}
                      </Botao>
                    ) : o.instalar ? (
                      <a
                        href={o.instalar}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-white/70 hover:border-white/40 hover:text-white"
                      >
                        Instalar ↗
                      </a>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
          {erro && <p className="mb-3 px-1 text-xs text-saida">{erro}</p>}

          <Botao variante="ghost" onClick={entrarDemo} className="text-white/70">
            Continuar sem carteira (modo demo)
          </Botao>
          <p className="mt-2 text-center text-[11px] text-white/35">
            Qualquer carteira Solana compatível com Wallet Standard também aparece aqui quando instalada.
          </p>
        </>
      )}
    </main>
  );
}

function IconeCarteira({ opcao }: { opcao: CarteiraOpcao }) {
  if (opcao.icone) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={opcao.icone} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl" />;
  }
  const cor = CORES[opcao.id] ?? "#94A3B8";
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-semibold"
      style={{ backgroundColor: `${cor}22`, color: cor, border: `1px solid ${cor}55` }}
    >
      {opcao.nome.slice(0, 1)}
    </span>
  );
}
