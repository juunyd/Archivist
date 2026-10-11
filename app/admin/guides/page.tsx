import { AdminPageHeader } from "../AdminPageHeader";
import { GuidesListContent } from "./GuidesListContent";

export default function AdminGuidesPage() {
  return (
    <>
      <AdminPageHeader title="Guides" subtitle="Catalogue, pricing and publishing." />
      <GuidesListContent />
    </>
  );
}
