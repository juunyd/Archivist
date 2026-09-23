import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DownloadContent } from "./DownloadContent";

const navLinks = [
  { href: "/#shelf", label: "Shelf" },
  { href: "/#standard", label: "Standard" },
  { href: "/#faq", label: "FAQ" },
];

const footerLinks = [
  { href: "/#shelf", label: "Collections" },
  { href: "/#standard", label: "Editorial standard" },
  { href: "/#faq", label: "FAQ" },
];

export const metadata: Metadata = {
  title: "Download",
  description: "Download your Archivist guide.",
  // A download link should never end up in a search index.
  robots: { index: false, follow: false },
};

export default function DownloadPage() {
  return (
    <>
      <Header navLinks={navLinks} />
      <section className="download">
        <div className="container-narrow download__inner">
          <h1 className="download__heading">Your download</h1>
          <Suspense
            fallback={<p className="download__body">Preparing your download&hellip;</p>}
          >
            <DownloadContent />
          </Suspense>
        </div>
      </section>
      <Footer collectionsLinks={footerLinks} />
    </>
  );
}
