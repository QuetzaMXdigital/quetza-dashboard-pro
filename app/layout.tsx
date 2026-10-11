import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quetza Analytics",
  description: "Análisis avanzado de Historial de Posiciones",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-950 text-white">{children}</body>
    </html>
  );
}