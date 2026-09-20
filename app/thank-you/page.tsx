import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ThankYouContent } from "./ThankYouContent";

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
  title: "Thank you",
  description: "Order confirmation.",
};

export default function ThankYouPage() {
  return (
    <>
      <Header navLinks={navLinks} />
      <section className="thank-you">
        <div className="container-narrow thank-you__inner">
          <h1 className="thank-you__heading">Thank you.</h1>
          <Suspense fallback={<p className="thank-you__body">Loading&hellip;</p>}>
            <ThankYouContent />
          </Suspense>
        </div>
      </section>
      <Footer collectionsLinks={footerLinks} />
    </>
  );
}
