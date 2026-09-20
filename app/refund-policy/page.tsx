import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "Refund policy for Archivist.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund policy">
      <p>
        This page is a placeholder. In short: reply to your delivery email
        within 30 days for a full refund, and keep the files. Full terms will
        be published here.
      </p>
    </LegalPage>
  );
}
