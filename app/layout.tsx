import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whale Intel — On-Chain Dashboard",
  description: "Internal on-chain wallet intelligence dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
