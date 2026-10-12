import { Suspense } from "react";
import { GuideEditContent } from "./GuideEditContent";

export default function AdminGuideEditPage() {
  return (
    <Suspense fallback={<p className="admin__state">Loading…</p>}>
      <GuideEditContent />
    </Suspense>
  );
}
