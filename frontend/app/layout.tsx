import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agentic OS — Commercial Layer",
  description: "Lead → email → creative → Meta Ads, governed by an audit trail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
