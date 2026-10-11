import { AdminPageHeader } from "./AdminPageHeader";
import { AdminDashboardContent } from "./AdminDashboardContent";

export default function AdminPage() {
  return (
    <>
      <AdminPageHeader title="Overview" subtitle="Analytics — all times IST, amounts in rupees." />
      <AdminDashboardContent />
    </>
  );
}
