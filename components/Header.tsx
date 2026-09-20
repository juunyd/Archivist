"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export interface NavLink {
  href: string;
  label: string;
}

interface HeaderProps {
  navLinks: NavLink[];
}

export function Header({ navLinks }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <header className="site-header">
      <div className="container site-header__bar">
        <Link href="/" aria-label="Archivist home">
          <Image
            src="/images/archivist-logo.webp"
            alt="Archivist"
            height={30}
            width={120}
            style={{ height: 30, width: "auto" }}
            priority
          />
        </Link>
        <nav className="site-header__nav" aria-label="Primary">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          className="site-header__burger"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </div>
      {menuOpen && (
        <div id={menuId} className="site-header__mobile-menu">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
