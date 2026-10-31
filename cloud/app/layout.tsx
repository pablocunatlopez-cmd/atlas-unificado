import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas · Crear, pensar, aprender",
  description: "Un espacio mínimo para crear código, renders, escenas 3D y juegos con herramientas propias, y conservar lo aprendido.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
