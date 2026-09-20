import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of service for Archivist.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>This page is a placeholder. Terms of service will be published here.</p>
    </LegalPage>
  );
}
