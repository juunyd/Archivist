import { AdminNav } from "../AdminNav";
import { GuidesListContent } from "./GuidesListContent";

export default function AdminGuidesPage() {
  return (
    <>
      <header className="admin__header">
        <div>
          <h1 className="admin__title">Guides</h1>
          <p className="admin__subtitle">Catalogue, pricing and publishing.</p>
        </div>
        <AdminNav current="guides" />
      </header>
      <GuidesListContent />
    </>
  );
}
