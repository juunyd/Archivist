interface AdminNavProps {
  current: "dashboard" | "guides";
}

export function AdminNav({ current }: AdminNavProps) {
  return (
    <nav className="admin__nav" aria-label="Admin sections">
      <a href="/admin/" aria-current={current === "dashboard" ? "page" : undefined}>
        Dashboard
      </a>
      <a href="/admin/guides/" aria-current={current === "guides" ? "page" : undefined}>
        Guides
      </a>
    </nav>
  );
}
