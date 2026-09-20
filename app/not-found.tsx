import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

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

export default function NotFound() {
  return (
    <>
      <Header navLinks={navLinks} />
      <section className="not-found">
        <div className="container-narrow not-found__inner">
          <p className="not-found__code">404</p>
          <h1 className="not-found__heading">This page isn&apos;t on the shelf.</h1>
          <p className="not-found__body">
            The page you&apos;re looking for doesn&apos;t exist, or has moved.
          </p>
          <Link href="/" className="not-found__link">
            Back to Archivist
          </Link>
        </div>
      </section>
      <Footer collectionsLinks={footerLinks} />
    </>
  );
}
