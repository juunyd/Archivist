import { AdminPageHeader } from "../AdminPageHeader";
import { OrdersListContent } from "./OrdersListContent";

export default function AdminOrdersPage() {
  return (
    <>
      <AdminPageHeader title="Orders" subtitle="Full order history, search and filters." />
      <OrdersListContent />
    </>
  );
}
