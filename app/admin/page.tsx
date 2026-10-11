import { AdminDashboardContent } from "./AdminDashboardContent";

export default function AdminPage() {
  return (
    <>
      <header className="admin__header">
        <div>
          <h1 className="admin__title">Archivist Admin</h1>
          <p className="admin__subtitle">Analytics — all times IST.</p>
        </div>
        <nav className="admin__nav" aria-label="Admin sections">
          <a href="/admin/" aria-current="page">
            Dashboard
          </a>
        </nav>
      </header>
      <AdminDashboardContent />
    </>
  );
}
