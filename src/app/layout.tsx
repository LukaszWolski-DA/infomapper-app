import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/ui/components/toast";
import "./globals.css";

// The prototype uses IBM Plex Sans and IBM Plex Mono. IBM's own files, hosted with the app (chore e2e reliability, P3 B:
// no build or start fetches fonts from the network); their source and licence are in fonts/ibm-plex/README.md.
const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/ibm-plex/IBMPlexSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex/IBMPlexSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex/IBMPlexSans-SemiBold.woff2", weight: "600", style: "normal" },
  ],
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/ibm-plex/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
  ],
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
