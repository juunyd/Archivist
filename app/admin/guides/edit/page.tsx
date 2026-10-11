import { Suspense } from "react";
import { AdminPageHeader } from "../../AdminPageHeader";
import { GuideEditContent } from "./GuideEditContent";

export default function AdminGuideEditPage() {
  return (
    <>
      <AdminPageHeader title="Edit guide" subtitle="Price is entered in rupees and stored in paise." />
      <Suspense fallback={<p className="admin__state">Loading…</p>}>
        <GuideEditContent />
      </Suspense>
    </>
  );
}
