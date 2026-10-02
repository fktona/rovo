import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/app-shell";
import { RovoProviders } from "@/providers/RovoProviders";
import "./globals.css";

const manrope = localFont({
  src: "./fonts/Manrope.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

const description = "Make a market around a profile. Launch, scout, and trade profile tokens on Robinhood Chain.";

export const metadata: Metadata = {
  metadataBase: new URL("https://rovo.fun"),
  title: "Rovo",
  description,
  applicationName: "Rovo",
  openGraph: {
    type: "website",
    siteName: "Rovo",
    title: "Rovo",
    description,
    url: "https://rovo.fun",
    images: [
      {
        url: "/rovo-banner.png",
        width: 4200,
        height: 2160,
        alt: "Rovo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@rovodotfun",
    creator: "@rovodotfun",
    title: "Rovo",
    description,
    images: ["/rovo-banner.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("rovo-solana-theme");if(t!=="light"&&t!=="dark"){t="light"}document.documentElement.dataset.theme=t}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <RovoProviders>
          <AppShell>{children}</AppShell>
        </RovoProviders>
      </body>
    </html>
  );
}
