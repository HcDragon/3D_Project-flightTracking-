import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CesiumScripts } from "@/components/globe/CesiumScripts";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "WorldPulse · Live intelligence",
  description: "Real-time flight and maritime operations dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <CesiumScripts />
        {children}
      </body>
    </html>
  );
}
