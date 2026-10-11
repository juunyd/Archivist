import { AdminDashboardContent } from "./AdminDashboardContent";
import { AdminNav } from "./AdminNav";

export default function AdminPage() {
  return (
    <>
      <header className="admin__header">
        <div>
          <h1 className="admin__title">Archivist Admin</h1>
          <p className="admin__subtitle">Analytics — all times IST.</p>
        </div>
        <AdminNav current="dashboard" />
      </header>
      <AdminDashboardContent />
    </>
  );
}
