import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leilões — Tottal Supply",
  description:
    "Painel de parede: pregões do dia com contagem regressiva e alarme sonoro.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
