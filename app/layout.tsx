import type { Metadata, Viewport } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], variable: "--font-sarabun" });

export const metadata: Metadata = {
  title: "การบ้านหลังนวด",
  description: "แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยทำที่บ้าน แล้วผลกลับถึงคลินิก",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7c2d12" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
