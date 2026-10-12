"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FunctionError, getJson, postJson, putJson } from "@/lib/api";
import { TwoFieldListEditor, type TwoFieldItem } from "../TwoFieldListEditor";
import { PublishChangesButton } from "../PublishChangesButton";
import { BUTTON_TEXT_MAX_LENGTH, DEFAULT_BUTTON_TEXT } from "@/lib/button-text";

interface AdminGuideDetail {
  slug: string;
  title: string;
  number: string | null;
  subtitle: string | null;
  blurb: string | null;
  description: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  currency: string;
  pageCount: number | null;
  chapterCount: number | null;
  whatsInside: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  badge: string | null;
  buttonText: string | null;
  coverPath: string | null;
  pdfPath: string | null;
  status: "draft" | "published";
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string | null;
  paidOrders: number;
  totalOrders: number;
  slugLocked: boolean;
  bonusTitle: string | null;
  bonusDescription: string | null;
  bonusCoverPath: string | null;
  bonusPdfPath: string | null;
  bonusEnabled: boolean;
}

interface FormState {
  slug: string;
  title: string;
  number: string;
  subtitle: string;
  blurb: string;
  description: string;
  priceRupees: string;
  compareAtPriceRupees: string;
  pageCount: string;
  chapterCount: string;
  badge: string;
  buttonText: string;
  sortOrder: string;
  status: "draft" | "published";
  whatsInside: TwoFieldItem[];
  faqs: TwoFieldItem[];
  bonusTitle: string;
  bonusDescription: string;
  bonusEnabled: boolean;
}

const EMPTY_FORM: FormState = {
  slug: "",
  title: "",
  number: "",
  subtitle: "",
  blurb: "",
  description: "",
  priceRupees: "",
  compareAtPriceRupees: "",
  pageCount: "",
  chapterCount: "",
  badge: "",
  buttonText: "",
  sortOrder: "",
  status: "draft",
  whatsInside: [],
  faqs: [],
  bonusTitle: "",
  bonusDescription: "",
  bonusEnabled: false,
};

function guideToForm(guide: AdminGuideDetail): FormState {
  return {
    slug: guide.slug,
    title: guide.title,
    number: guide.number ?? "",
    subtitle: guide.subtitle ?? "",
    blurb: guide.blurb ?? "",
    description: guide.description ?? "",
    priceRupees: String(guide.pricePaise / 100),
    compareAtPriceRupees: guide.compareAtPricePaise != null ? String(guide.compareAtPricePaise / 100) : "",
    pageCount: guide.pageCount != null ? String(guide.pageCount) : "",
    chapterCount: guide.chapterCount != null ? String(guide.chapterCount) : "",
    badge: guide.badge ?? "",
    buttonText: guide.buttonText ?? "",
    sortOrder: guide.sortOrder != null ? String(guide.sortOrder) : "",
    status: guide.status,
    whatsInside: guide.whatsInside.map((w) => ({ a: w.title, b: w.description })),
    faqs: guide.faqs.map((f) => ({ a: f.question, b: f.answer })),
    bonusTitle: guide.bonusTitle ?? "",
    bonusDescription: guide.bonusDescription ?? "",
    bonusEnabled: guide.bonusEnabled,
  };
}

function formatRupees(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

type Mode = "loading" | "create" | "edit" | "not_found" | "error";

export function GuideEditContent() {
  const searchParams = useSearchParams();
  const slugParam = searchParams.get("slug");

  const [mode, setMode] = useState<Mode>(slugParam ? "loading" : "create");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guide, setGuide] = useState<AdminGuideDetail | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [initialPriceRupees, setInitialPriceRupees] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverMessage, setCoverMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfMessage, setPdfMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [bonusCoverFile, setBonusCoverFile] = useState<File | null>(null);
  const [bonusCoverUploading, setBonusCoverUploading] = useState(false);
  const [bonusCoverMessage, setBonusCoverMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [bonusPdfFile, setBonusPdfFile] = useState<File | null>(null);
  const [bonusPdfUploading, setBonusPdfUploading] = useState(false);
  const [bonusPdfMessage, setBonusPdfMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [unpublishing, setUnpublishing] = useState(false);

  useEffect(() => {
    if (!slugParam) return;
    void (async () => {
      try {
        const data = await getJson<{ guide: AdminGuideDetail }>(`/api/admin/guides/${encodeURIComponent(slugParam)}`, {});
        setGuide(data.guide);
        setForm(guideToForm(data.guide));
        setInitialPriceRupees(data.guide.pricePaise / 100);
        setMode("edit");
      } catch (error) {
        if (error instanceof FunctionError && error.code === "not_found") {
          setMode("not_found");
        } else {
          setMode("error");
          setLoadError(error instanceof Error ? error.message : "Could not load this guide.");
        }
      }
    })();
    // Only re-run if the slug in the URL actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugParam]);

  const coverPreviewUrl = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  const bonusCoverPreviewUrl = useMemo(
    () => (bonusCoverFile ? URL.createObjectURL(bonusCoverFile) : null),
    [bonusCoverFile],
  );
  useEffect(() => {
    return () => {
      if (bonusCoverPreviewUrl) URL.revokeObjectURL(bonusCoverPreviewUrl);
    };
  }, [bonusCoverPreviewUrl]);

  const priceChanged =
    initialPriceRupees !== null &&
    form.priceRupees !== "" &&
    Number.parseFloat(form.priceRupees) !== initialPriceRupees;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);

    if (form.whatsInside.length === 0 || form.faqs.length === 0) {
      setSaveMessage({ text: 'Add at least one "what\'s inside" item and one FAQ before saving.', error: true });
      return;
    }

    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      blurb: form.blurb.trim(),
      description: form.description.trim() || undefined,
      number: form.number.trim() || undefined,
      pricePaise: Math.round(Number.parseFloat(form.priceRupees || "0") * 100),
      compareAtPricePaise: form.compareAtPriceRupees
        ? Math.round(Number.parseFloat(form.compareAtPriceRupees) * 100)
        : undefined,
      pageCount: Number.parseInt(form.pageCount, 10),
      chapterCount: Number.parseInt(form.chapterCount, 10),
      whatsInside: form.whatsInside.map((item) => ({ title: item.a.trim(), description: item.b.trim() })),
      faqs: form.faqs.map((item) => ({ question: item.a.trim(), answer: item.b.trim() })),
      badge: form.badge.trim() || undefined,
      buttonText: form.buttonText.trim() || undefined,
      status: form.status,
      sortOrder: form.sortOrder ? Number.parseInt(form.sortOrder, 10) : undefined,
      bonusTitle: form.bonusTitle.trim() || undefined,
      bonusDescription: form.bonusDescription.trim() || undefined,
      bonusEnabled: form.bonusEnabled,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await postJson<{ guide: AdminGuideDetail }>("/api/admin/guides", payload);
        setGuide(res.guide);
        setForm(guideToForm(res.guide));
        setInitialPriceRupees(res.guide.pricePaise / 100);
        setMode("edit");
        window.history.replaceState(null, "", `/admin/guides/edit/?slug=${encodeURIComponent(res.guide.slug)}`);
        setSaveMessage({ text: "Guide created as a draft. Upload a cover and PDF, then publish it when it's ready." });
      } else if (guide) {
        const res = await putJson<{ guide: AdminGuideDetail }>(`/api/admin/guides/${encodeURIComponent(guide.slug)}`, payload);
        setGuide(res.guide);
        setForm(guideToForm(res.guide));
        setSaveMessage({ text: "Saved." });
      }
    } catch (error) {
      setSaveMessage({ text: error instanceof Error ? error.message : "Could not save.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleCoverUpload() {
    if (!coverFile || !guide) return;
    setCoverUploading(true);
    setCoverMessage(null);
    try {
      const body = new FormData();
      body.set("file", coverFile);
      const res = await fetch(`/api/admin/guides/${encodeURIComponent(guide.slug)}/cover`, { method: "POST", body });
      const parsed = (await res.json()) as { guide?: AdminGuideDetail; error?: { message?: string } };
      if (!res.ok) throw new Error(parsed.error?.message ?? "Could not upload the cover.");
      setGuide(parsed.guide!);
      setCoverFile(null);
      setCoverMessage({ text: "Cover uploaded." });
    } catch (error) {
      setCoverMessage({ text: error instanceof Error ? error.message : "Could not upload the cover.", error: true });
    } finally {
      setCoverUploading(false);
    }
  }

  async function handlePdfUpload(confirmOverwrite: boolean) {
    if (!pdfFile || !guide) return;
    if (guide.pdfPath && !confirmOverwrite) {
      const ok = window.confirm(
        "This guide already has a PDF, and paying customers download that exact file. Replace it?",
      );
      if (!ok) return;
      return handlePdfUpload(true);
    }
    setPdfUploading(true);
    setPdfMessage(null);
    try {
      const url = `/api/admin/guides/${encodeURIComponent(guide.slug)}/pdf${confirmOverwrite ? "?confirm=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: pdfFile,
      });
      const parsed = (await res.json()) as { guide?: AdminGuideDetail; error?: { message?: string } };
      if (!res.ok) throw new Error(parsed.error?.message ?? "Could not upload the PDF.");
      setGuide(parsed.guide!);
      setPdfFile(null);
      setPdfMessage({ text: "PDF uploaded." });
    } catch (error) {
      setPdfMessage({ text: error instanceof Error ? error.message : "Could not upload the PDF.", error: true });
    } finally {
      setPdfUploading(false);
    }
  }

  async function handleBonusCoverUpload() {
    if (!bonusCoverFile || !guide) return;
    setBonusCoverUploading(true);
    setBonusCoverMessage(null);
    try {
      const body = new FormData();
      body.set("file", bonusCoverFile);
      const res = await fetch(`/api/admin/guides/${encodeURIComponent(guide.slug)}/bonus-cover`, { method: "POST", body });
      const parsed = (await res.json()) as { guide?: AdminGuideDetail; error?: { message?: string } };
      if (!res.ok) throw new Error(parsed.error?.message ?? "Could not upload the bonus cover.");
      setGuide(parsed.guide!);
      setBonusCoverFile(null);
      setBonusCoverMessage({ text: "Bonus cover uploaded." });
    } catch (error) {
      setBonusCoverMessage({ text: error instanceof Error ? error.message : "Could not upload the bonus cover.", error: true });
    } finally {
      setBonusCoverUploading(false);
    }
  }

  async function handleBonusPdfUpload(confirmOverwrite: boolean) {
    if (!bonusPdfFile || !guide) return;
    if (guide.bonusPdfPath && !confirmOverwrite) {
      const ok = window.confirm(
        "This guide already has a bonus PDF, and paying customers download that exact file. Replace it?",
      );
      if (!ok) return;
      return handleBonusPdfUpload(true);
    }
    setBonusPdfUploading(true);
    setBonusPdfMessage(null);
    try {
      const url = `/api/admin/guides/${encodeURIComponent(guide.slug)}/bonus-pdf${confirmOverwrite ? "?confirm=true" : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: bonusPdfFile,
      });
      const parsed = (await res.json()) as { guide?: AdminGuideDetail; error?: { message?: string } };
      if (!res.ok) throw new Error(parsed.error?.message ?? "Could not upload the bonus PDF.");
      setGuide(parsed.guide!);
      setBonusPdfFile(null);
      setBonusPdfMessage({ text: "Bonus PDF uploaded." });
    } catch (error) {
      setBonusPdfMessage({ text: error instanceof Error ? error.message : "Could not upload the bonus PDF.", error: true });
    } finally {
      setBonusPdfUploading(false);
    }
  }

  async function handleUnpublish() {
    if (!guide) return;
    const ok = window.confirm(`Unpublish "${guide.title}"? It will stop being sold until you publish it again.`);
    if (!ok) return;
    setUnpublishing(true);
    try {
      const res = await postJson<{ guide: AdminGuideDetail }>(
        `/api/admin/guides/${encodeURIComponent(guide.slug)}/unpublish`,
        {},
      );
      setGuide(res.guide);
      setForm((prev) => ({ ...prev, status: res.guide.status }));
      setSaveMessage({ text: "Unpublished." });
    } catch (error) {
      setSaveMessage({ text: error instanceof Error ? error.message : "Could not unpublish.", error: true });
    } finally {
      setUnpublishing(false);
    }
  }

  if (mode === "loading") return <p className="admin__state">Loading guide…</p>;
  if (mode === "not_found") return <p className="admin__state">No guide with that slug. Go back to the guides list.</p>;
  if (mode === "error") return <p className="admin__state">{loadError}</p>;

  const price = Number.parseFloat(form.priceRupees);
  const compareAt = form.compareAtPriceRupees ? Number.parseFloat(form.compareAtPriceRupees) : null;

  return (
    <form className="admin__guide-form" onSubmit={handleSave}>
      <div className="admin__guide-form-grid">
        <div className="admin__field">
          <label htmlFor="g-slug">Slug</label>
          <input
            id="g-slug"
            type="text"
            value={form.slug}
            onChange={(e) => updateField("slug", e.target.value)}
            disabled={mode === "edit" && !!guide?.slugLocked}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            minLength={3}
            maxLength={60}
          />
          {mode === "edit" && guide?.slugLocked && (
            <span className="admin__field-hint">
              Locked — this guide has {guide.totalOrders > 0 ? "orders" : "a PDF uploaded"}.
            </span>
          )}
        </div>

        <div className="admin__field">
          <label htmlFor="g-status">Status</label>
          <select id="g-status" value={form.status} onChange={(e) => updateField("status", e.target.value as "draft" | "published")}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="admin__field">
          <label htmlFor="g-title">Title</label>
          <input id="g-title" type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)} required />
        </div>

        <div className="admin__field">
          <label htmlFor="g-number">Number (e.g. &quot;No. 05&quot;)</label>
          <input id="g-number" type="text" value={form.number} onChange={(e) => updateField("number", e.target.value)} />
        </div>

        <div className="admin__field admin__field--wide">
          <label htmlFor="g-subtitle">Subtitle</label>
          <input id="g-subtitle" type="text" value={form.subtitle} onChange={(e) => updateField("subtitle", e.target.value)} required />
        </div>

        <div className="admin__field admin__field--wide">
          <label htmlFor="g-blurb">Blurb (shelf card)</label>
          <textarea id="g-blurb" value={form.blurb} onChange={(e) => updateField("blurb", e.target.value)} rows={2} required />
        </div>

        <div className="admin__field admin__field--wide">
          <label htmlFor="g-description">Description</label>
          <textarea id="g-description" value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={2} />
        </div>

        <div className="admin__field">
          <label htmlFor="g-price">Price (₹)</label>
          <input
            id="g-price"
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={form.priceRupees}
            onChange={(e) => updateField("priceRupees", e.target.value)}
            required
          />
        </div>

        <div className="admin__field">
          <label htmlFor="g-compare-price">Compare-at price (₹, optional)</label>
          <input
            id="g-compare-price"
            type="number"
            min="1"
            step="1"
            inputMode="decimal"
            value={form.compareAtPriceRupees}
            onChange={(e) => updateField("compareAtPriceRupees", e.target.value)}
          />
        </div>

        <div className="admin__field">
          <label htmlFor="g-pages">Page count</label>
          <input id="g-pages" type="number" min="1" step="1" value={form.pageCount} onChange={(e) => updateField("pageCount", e.target.value)} required />
        </div>

        <div className="admin__field">
          <label htmlFor="g-chapters">Chapter count</label>
          <input
            id="g-chapters"
            type="number"
            min="1"
            step="1"
            value={form.chapterCount}
            onChange={(e) => updateField("chapterCount", e.target.value)}
            required
          />
        </div>

        <div className="admin__field">
          <label htmlFor="g-badge">Badge (optional)</label>
          <input id="g-badge" type="text" value={form.badge} onChange={(e) => updateField("badge", e.target.value)} />
        </div>

        <div className="admin__field">
          <label htmlFor="g-button-text">Button text (optional)</label>
          <input
            id="g-button-text"
            type="text"
            value={form.buttonText}
            onChange={(e) => updateField("buttonText", e.target.value)}
            maxLength={BUTTON_TEXT_MAX_LENGTH}
            placeholder={DEFAULT_BUTTON_TEXT}
          />
          <span className="admin__field-hint">
            {form.buttonText.length}/{BUTTON_TEXT_MAX_LENGTH} — shown as &quot;{form.buttonText.trim() || DEFAULT_BUTTON_TEXT} - ₹{form.priceRupees || "…"} →&quot;. Leave empty for the default.
          </span>
        </div>

        <div className="admin__field">
          <label htmlFor="g-sort">Sort order (optional)</label>
          <input id="g-sort" type="number" step="1" value={form.sortOrder} onChange={(e) => updateField("sortOrder", e.target.value)} />
        </div>
      </div>

      {Number.isFinite(price) && (
        <p className="admin__price-preview">
          {compareAt != null && compareAt > price && (
            <span className="admin__price-preview-compare">{formatRupees(compareAt)}</span>
          )}
          <span className="admin__price-preview-price">{formatRupees(price)}</span>
        </p>
      )}

      {priceChanged && (
        <p className="admin__price-warning">
          Price changes take effect at checkout immediately, but the site shows the old price until it rebuilds.
          Click Publish changes.
        </p>
      )}

      <section className="admin__section">
        <h2 className="admin__section-title">What&apos;s inside</h2>
        <TwoFieldListEditor
          items={form.whatsInside}
          onChange={(items) => updateField("whatsInside", items)}
          labelA="Title"
          labelB="Description"
          addLabel="Add item"
          itemNoun="item"
        />
      </section>

      <section className="admin__section">
        <h2 className="admin__section-title">FAQs</h2>
        <TwoFieldListEditor
          items={form.faqs}
          onChange={(items) => updateField("faqs", items)}
          labelA="Question"
          labelB="Answer"
          addLabel="Add FAQ"
          itemNoun="FAQ"
        />
      </section>

      <div className="admin__form-actions">
        <button type="submit" className="admin__form-submit" disabled={saving}>
          {saving ? "Saving…" : mode === "create" ? "Create guide" : "Save"}
        </button>
        {saveMessage && (
          <span className={`admin__form-message${saveMessage.error ? " admin__form-message--error" : ""}`}>{saveMessage.text}</span>
        )}
      </div>

      {mode === "edit" && guide && (
        <>
          <section className="admin__section">
            <h2 className="admin__section-title">Cover image</h2>
            <div className="admin__upload-row">
              <div className="admin__upload-preview">
                {coverPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreviewUrl} alt="Selected cover preview" className="admin__guide-thumb admin__guide-thumb--large" />
                ) : guide.coverPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guide.coverPath} alt="Current cover" className="admin__guide-thumb admin__guide-thumb--large" />
                ) : (
                  <span className="admin__guide-thumb admin__guide-thumb--large admin__guide-thumb--empty" aria-hidden="true" />
                )}
              </div>
              <div className="admin__upload-controls">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
                {coverFile && (
                  <span className="admin__upload-filename">
                    {coverFile.name} ({formatFileSize(coverFile.size)})
                  </span>
                )}
                <button type="button" className="admin__form-submit" onClick={handleCoverUpload} disabled={!coverFile || coverUploading}>
                  {coverUploading ? "Uploading…" : "Upload cover"}
                </button>
                {coverMessage && (
                  <span className={`admin__form-message${coverMessage.error ? " admin__form-message--error" : ""}`}>{coverMessage.text}</span>
                )}
              </div>
            </div>
          </section>

          <section className="admin__section">
            <h2 className="admin__section-title">PDF</h2>
            <div className="admin__upload-row">
              <div className="admin__upload-controls">
                <p className="admin__upload-current">
                  {guide.pdfPath ? `Current file: ${guide.pdfPath}` : "No PDF uploaded yet."}
                </p>
                <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
                {pdfFile && (
                  <span className="admin__upload-filename">
                    {pdfFile.name} ({formatFileSize(pdfFile.size)})
                  </span>
                )}
                <button type="button" className="admin__form-submit" onClick={() => handlePdfUpload(false)} disabled={!pdfFile || pdfUploading}>
                  {pdfUploading ? "Uploading…" : guide.pdfPath ? "Replace PDF" : "Upload PDF"}
                </button>
                {pdfMessage && (
                  <span className={`admin__form-message${pdfMessage.error ? " admin__form-message--error" : ""}`}>{pdfMessage.text}</span>
                )}
              </div>
            </div>
          </section>

          <section className="admin__section">
            <h2 className="admin__section-title">Free bonus</h2>
            <div className="admin__guide-form-grid">
              <div className="admin__field">
                <label htmlFor="g-bonus-title">Bonus title</label>
                <input
                  id="g-bonus-title"
                  type="text"
                  value={form.bonusTitle}
                  onChange={(e) => updateField("bonusTitle", e.target.value)}
                />
              </div>

              <div className="admin__field">
                <label htmlFor="g-bonus-enabled">Show bonus</label>
                <select
                  id="g-bonus-enabled"
                  value={form.bonusEnabled ? "on" : "off"}
                  onChange={(e) => updateField("bonusEnabled", e.target.value === "on")}
                >
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </select>
              </div>

              <div className="admin__field admin__field--wide">
                <label htmlFor="g-bonus-description">Bonus description (short)</label>
                <textarea
                  id="g-bonus-description"
                  value={form.bonusDescription}
                  onChange={(e) => updateField("bonusDescription", e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="admin__upload-row">
              <div className="admin__upload-preview">
                {bonusCoverPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bonusCoverPreviewUrl} alt="Selected bonus cover preview" className="admin__guide-thumb admin__guide-thumb--large" />
                ) : guide.bonusCoverPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guide.bonusCoverPath} alt="Current bonus cover" className="admin__guide-thumb admin__guide-thumb--large" />
                ) : (
                  <span className="admin__guide-thumb admin__guide-thumb--large admin__guide-thumb--empty" aria-hidden="true" />
                )}
              </div>
              <div className="admin__upload-controls">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setBonusCoverFile(e.target.files?.[0] ?? null)}
                />
                {bonusCoverFile && (
                  <span className="admin__upload-filename">
                    {bonusCoverFile.name} ({formatFileSize(bonusCoverFile.size)})
                  </span>
                )}
                <button type="button" className="admin__form-submit" onClick={handleBonusCoverUpload} disabled={!bonusCoverFile || bonusCoverUploading}>
                  {bonusCoverUploading ? "Uploading…" : "Upload bonus cover"}
                </button>
                {bonusCoverMessage && (
                  <span className={`admin__form-message${bonusCoverMessage.error ? " admin__form-message--error" : ""}`}>{bonusCoverMessage.text}</span>
                )}
              </div>
            </div>

            <div className="admin__upload-row">
              <div className="admin__upload-controls">
                <p className="admin__upload-current">
                  {guide.bonusPdfPath ? `Current file: ${guide.bonusPdfPath}` : "No bonus PDF uploaded yet."}
                </p>
                <input type="file" accept="application/pdf" onChange={(e) => setBonusPdfFile(e.target.files?.[0] ?? null)} />
                {bonusPdfFile && (
                  <span className="admin__upload-filename">
                    {bonusPdfFile.name} ({formatFileSize(bonusPdfFile.size)})
                  </span>
                )}
                <button type="button" className="admin__form-submit" onClick={() => handleBonusPdfUpload(false)} disabled={!bonusPdfFile || bonusPdfUploading}>
                  {bonusPdfUploading ? "Uploading…" : guide.bonusPdfPath ? "Replace bonus PDF" : "Upload bonus PDF"}
                </button>
                {bonusPdfMessage && (
                  <span className={`admin__form-message${bonusPdfMessage.error ? " admin__form-message--error" : ""}`}>{bonusPdfMessage.text}</span>
                )}
              </div>
            </div>
          </section>

          <section className="admin__section admin__publish-section">
            <PublishChangesButton onPublished={() => setInitialPriceRupees(Number.parseFloat(form.priceRupees))} />
            {guide.status === "published" && (
              <button type="button" className="admin__danger-link" onClick={handleUnpublish} disabled={unpublishing}>
                {unpublishing ? "Unpublishing…" : "Unpublish"}
              </button>
            )}
          </section>
        </>
      )}
    </form>
  );
}
