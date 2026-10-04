import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";

// Looped (มีหัว) Thai reads better for older eyes: body and UI. The loopless face is for display sizes (≥ 28px) only.
const looped = IBM_Plex_Sans_Thai_Looped({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-looped" });
const plexThai = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["600", "700"], variable: "--font-plex-thai" });

export const metadata: Metadata = {
  title: "การบ้านหลังนวด",
  description: "แพทย์แผนไทยสั่งท่าฤๅษีดัดตนของกรมการแพทย์แผนไทยฯ ให้ผู้ป่วยทำที่บ้าน แล้วผลกลับถึงคลินิก",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#145139" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${looped.variable} ${plexThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
