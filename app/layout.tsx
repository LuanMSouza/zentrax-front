import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import './globals.css'
import { Titlebar } from "@/blocos/titlebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZentraX",
  description: "Gerenciador de cobranças",
  appleWebApp: {
    title: 'Zentrax',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body className="...">
        <Titlebar /> {/* O Next.js entende que só este pedaço é Client Side */}
        {children}
      </body>
    </html>
  );
}