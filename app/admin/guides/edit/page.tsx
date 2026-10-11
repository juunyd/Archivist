import { Suspense } from "react";
import { AdminNav } from "../../AdminNav";
import { GuideEditContent } from "./GuideEditContent";

export default function AdminGuideEditPage() {
  return (
    <>
      <header className="admin__header">
        <div>
          <h1 className="admin__title">Edit guide</h1>
          <p className="admin__subtitle">Price is entered in rupees and stored in paise.</p>
        </div>
        <AdminNav current="guides" />
      </header>
      <Suspense fallback={<p className="admin__state">Loading…</p>}>
        <GuideEditContent />
      </Suspense>
    </>
  );
}
