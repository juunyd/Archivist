import { AdminPageHeader } from "../AdminPageHeader";
import { BuyersList } from "./BuyersList";
import { StartedList } from "./StartedList";

export default function AdminEmailsPage() {
  return (
    <>
      <AdminPageHeader title="Emails" subtitle="Buyers, and checkouts that started but didn't pay." />
      <div className="admin__email-lists">
        <BuyersList />
        <StartedList />
      </div>
    </>
  );
}
