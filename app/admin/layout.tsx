import type { Metadata } from "next";
import "./admin.css";
import { AdminShell } from "./AdminShell";

// Belt-and-suspenders with the Cloudflare Access policy: even if a crawler or
// a stray link ever reached /admin, this tells it not to index or follow.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
