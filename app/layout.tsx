import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amigos de lo Ajeno LP's",
  description: "Tasador de vinilos: subí las fotos y te decimos si el precio pedido vale la pena.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-groove">{children}</body>
    </html>
  );
}
