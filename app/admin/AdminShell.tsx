"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdSpendIcon, GuidesIcon, OrdersIcon, OverviewIcon } from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/", label: "Overview", icon: OverviewIcon },
  { href: "/admin/orders/", label: "Orders", icon: OrdersIcon },
  { href: "/admin/guides/", label: "Guides", icon: GuidesIcon },
  { href: "/admin/ad-spend/", label: "Ad spend", icon: AdSpendIcon },
];

function isActive(pathname: string, href: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const normalizedHref = href.replace(/\/+$/, "") || "/";
  if (normalizedHref === "/admin") return normalizedPath === "/admin";
  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar" aria-label="Admin sections">
        <Link href="/admin/" className="admin-shell__brand">
          <Image src="/images/archivist-logo.webp" alt="Archivist" width={120} height={30} style={{ height: 26, width: "auto" }} />
        </Link>
        <nav className="admin-shell__nav">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="admin-shell__nav-item"
                aria-current={active ? "page" : undefined}
              >
                <Icon className="admin-shell__nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="admin-shell__bottombar" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="admin-shell__bottombar-item"
              aria-current={active ? "page" : undefined}
            >
              <Icon className="admin-shell__nav-icon" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-shell__main">
        <div className="admin-shell__content">{children}</div>
      </div>
    </div>
  );
}
