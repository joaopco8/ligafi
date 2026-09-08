import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({ className = "", children, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-2xl border border-mata-border/60 bg-mata-card p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palha";

const variantes = {
  primary: "bg-palha text-mata hover:bg-palha-dark",
  secondary: "border border-palha/50 text-palha hover:bg-palha/10",
  ghost: "text-white/80 hover:bg-white/5",
} as const;

type Variante = keyof typeof variantes;

export function Botao({
  variante = "primary",
  className = "",
  ...rest
}: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={`${base} ${variantes[variante]} ${className}`} {...rest} />;
}

export function BotaoLink({
  variante = "primary",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={`${base} ${variantes[variante]} ${className}`} {...rest} />;
}

// ---------------------------------------------------------------------------
// Topo de página
// ---------------------------------------------------------------------------

export function Topo({
  voltar,
  titulo,
  sub,
  acao,
}: {
  voltar?: { href: string; label?: string };
  titulo: ReactNode;
  sub?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-5">
      {voltar && (
        <Link
          href={voltar.href}
          className="mb-3 inline-flex items-center gap-1 text-sm text-white/55 hover:text-white"
        >
          <span aria-hidden>←</span> {voltar.label ?? "Voltar"}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.01em]">{titulo}</h1>
          {sub && <p className="mt-1 text-sm text-white/55">{sub}</p>}
        </div>
        {acao}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Marca
// ---------------------------------------------------------------------------

/** Logo completa (escudo + wordmark). `tamanho` = altura em px. */
export function Marca({ className = "", tamanho = 36 }: { className?: string; tamanho?: number }) {
  const largura = Math.round(tamanho * (1079 / 501));
  return (
    <Link href="/" aria-label="LigaFi — início" className={`inline-flex items-center ${className}`}>
      <Image src="/logo.png" alt="LigaFi" width={largura} height={tamanho} priority className="h-auto" style={{ width: largura }} />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Rótulo pequeno
// ---------------------------------------------------------------------------

export function Rotulo({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium uppercase tracking-[0.12em] text-white/45 ${className}`}>
      {children}
    </p>
  );
}
