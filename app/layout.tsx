import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { Archivo, Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap"
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap"
});

export const metadata: Metadata = {
  title: "VervAI — Turn your content into your next best content",
  description: BRAND.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  );
}