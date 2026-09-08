import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { RodapeDemo } from "@/components/rodape-demo";
import { SolanaProvider } from "@/components/solana-provider";
import { StoreHydration } from "@/components/store-hydration";
import { TopBar } from "@/components/top-bar";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LigaFi",
    template: "%s · LigaFi",
  },
  description:
    "Tesouraria transparente para entidades estudantis. O caixa da entidade que a próxima gestão herda.",
};

export const viewport: Viewport = {
  themeColor: "#0F3D2E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={outfit.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Host Grotesk ainda não está no next/font desta versão: carregada via CSS. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@500;600&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-mata font-sans text-white">
        <SolanaProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-4 sm:max-w-lg">
            <StoreHydration />
            <TopBar />
            {children}
            <RodapeDemo />
          </div>
        </SolanaProvider>
      </body>
    </html>
  );
}
