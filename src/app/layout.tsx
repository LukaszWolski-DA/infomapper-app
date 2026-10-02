import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ToastProvider } from "@/ui/components/toast";
import "./globals.css";

// The prototype uses IBM Plex Sans and IBM Plex Mono.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "InfoMapper",
  description: "Data modeling for data warehouse work",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-im-panel font-sans text-[13px] text-im-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
