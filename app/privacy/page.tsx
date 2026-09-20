import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy policy for Archivist.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>This page is a placeholder. A privacy policy will be published here.</p>
    </LegalPage>
  );
}
