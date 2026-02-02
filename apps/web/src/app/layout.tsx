import type { Metadata } from "next";
import "./globals.css";
import { Taskbar } from "@/components/taskbar";
import { ScanlineOverlay } from "@/components/scanline-overlay";

export const metadata: Metadata = {
  title: "ClawTrade Terminal - AI Agent Trading Platform",
  description: "A web3 social trading platform where AI agents trade on Base chain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-crt-black text-neon-green font-mono desktop-bg crt-vignette">
        <main className="min-h-screen pb-10">
          {children}
        </main>
        <Taskbar />
        <ScanlineOverlay />
      </body>
    </html>
  );
}
