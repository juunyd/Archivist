import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site";

export interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

interface FooterProps {
  collectionsLinks: FooterLink[];
}

export function Footer({ collectionsLinks }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <Image
            src="/images/archivist-logo-white.webp"
            alt="Archivist"
            height={30}
            width={120}
            style={{ height: 30, width: "auto", display: "block", marginBottom: 14 }}
          />
          <p className="site-footer__tagline">
            Solutions on hard problems, with every claim sourced.
          </p>
        </div>
        <div className="site-footer__links">
          {collectionsLinks.map((link) =>
            link.external ? (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            )
          )}
        </div>
        <div className="site-footer__links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refund policy</Link>
          <Link href="/contact">Contact</Link>
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
        </div>
      </div>
      <div className="container site-footer__bottom">
        &copy; {new Date().getFullYear()} Archivist.
      </div>
    </footer>
  );
}
