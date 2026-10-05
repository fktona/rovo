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

const description = "Launch and trade tokens on Solana.";

export const metadata: Metadata = {
  metadataBase: new URL("https://rovo.fun"),
  title: "TryFolio",
  description,
  applicationName: "TryFolio",
  icons: { icon: "/folio.png", apple: "/folio.png" },
  openGraph: {
    type: "website",
    siteName: "TryFolio",
    title: "TryFolio",
    description,
    url: "https://rovo.fun",
    images: [
      {
        url: "/folio.png",
        width: 305,
        height: 305,
        alt: "TryFolio",
      },
    ],
  },
  twitter: {
    card: "summary",
    site: "@tryfoliofun",
    creator: "@tryfoliofun",
    title: "TryFolio",
    description,
    images: ["/folio.png"],
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
