import { AdminPageHeader } from "../AdminPageHeader";
import { CustomersListContent } from "./CustomersListContent";

export default function AdminCustomersPage() {
  return (
    <>
      <AdminPageHeader title="Customers" subtitle="One row per buyer, with full purchase history." />
      <CustomersListContent />
    </>
  );
}
