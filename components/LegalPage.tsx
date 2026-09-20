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

interface LegalPageProps {
  title: string;
  children: React.ReactNode;
}

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <>
      <Header navLinks={navLinks} />
      <section style={{ padding: "76px var(--pad)" }}>
        <div className="container-narrow" style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: "clamp(28px, 5.5vw, 42px)", marginBottom: 24 }}>
            {title}
          </h1>
          <div style={{ fontSize: 15.5, lineHeight: 1.8, color: "var(--gray-900)" }}>
            {children}
          </div>
        </div>
      </section>
      <Footer collectionsLinks={footerLinks} />
    </>
  );
}
