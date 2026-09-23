import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { siteConfig } from "@/lib/site";
import { MetaPixel } from "@/components/MetaPixel";
import { MetaPixelPageView } from "@/components/MetaPixelPageView";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  verification: {
    other: {
      "facebook-domain-verification": "klh5vaavrolsn65fg0l0w0yow8icmi",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={archivo.variable}>
      <head>
        <MetaPixel />
      </head>
      <body>
        <MetaPixelPageView />
        {children}
      </body>
    </html>
  );
}
