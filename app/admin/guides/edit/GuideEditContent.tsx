"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FunctionError, getJson, postJson, putJson } from "@/lib/api";
import { PublishChangesButton } from "../PublishChangesButton";
import { BUTTON_TEXT_MAX_LENGTH, DEFAULT_BUTTON_TEXT, resolveButtonText } from "@/lib/button-text";
import { siteConfig } from "@/lib/site";
import { ArrowDownIcon, ArrowUpIcon, BackArrowIcon, PlusIcon, TrashIcon } from "../../icons";
import { LiveField, LiveImagePicker, LiveSwitch } from "./LiveField";
import pageStyles from "../../../[slug]/page.module.css";

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

interface InsideItem {
  a: string;
  b: string;
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
  whatsInside: InsideItem[];
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
    bonusTitle: guide.bonusTitle ?? "",
    bonusDescription: guide.bonusDescription ?? "",
    bonusEnabled: guide.bonusEnabled,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** The storage path is all we have for an already-uploaded file — this just
 * reads its filename back out for display, it never invents data. */
function basename(path: string | null): string | null {
  if (!path) return null;
  const parts = path.split("/");
  return parts[parts.length - 1] || null;
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

type Mode = "loading" | "create" | "edit" | "not_found" | "error";

/** Required-field marker: a small red dot next to the label, not a long note. */
function RequiredDot() {
  return <span className="admin__required-dot" aria-hidden="true" />;
}

/**
 * A clickable, drag-and-drop-friendly file picker. Purely a presentation
 * wrapper around the same native <input type="file"> + onFile callback every
 * upload already used — no new upload logic, no new library.
 */
function FileDropzone({
  id,
  accept,
  label,
  hint,
  onFile,
}: {
  id: string;
  accept: string;
  label: string;
  hint: string;
  onFile: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      htmlFor={id}
      className={`admin__dropzone${dragOver ? " admin__dropzone--active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <span className="admin__dropzone-label">{label}</span>
      <span className="admin__dropzone-hint">{hint}</span>
    </label>
  );
}

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

  // Presentational only: when the form last matched what the server has,
  // and a quick dirty-check against that snapshot to drive the
  // leave-page warning below. Never read by handleSave's payload.
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const savedSnapshotRef = useRef<string>(JSON.stringify(EMPTY_FORM));

  useEffect(() => {
    if (!slugParam) return;
    void (async () => {
      try {
        const data = await getJson<{ guide: AdminGuideDetail }>(`/api/admin/guides/${encodeURIComponent(slugParam)}`, {});
        const loaded = guideToForm(data.guide);
        setGuide(data.guide);
        setForm(loaded);
        setInitialPriceRupees(data.guide.pricePaise / 100);
        setLastSavedAt(data.guide.updatedAt ?? data.guide.createdAt);
        savedSnapshotRef.current = JSON.stringify(loaded);
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

  // Native "leave site?" prompt while the form has unsaved changes.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (JSON.stringify(form) !== savedSnapshotRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form]);

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

  function updateInsideItem(index: number, key: "a" | "b", value: string) {
    updateField(
      "whatsInside",
      form.whatsInside.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  function removeInsideItem(index: number) {
    updateField("whatsInside", form.whatsInside.filter((_, i) => i !== index));
  }

  function moveInsideItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form.whatsInside.length) return;
    const next = form.whatsInside.slice();
    [next[index], next[target]] = [next[target], next[index]];
    updateField("whatsInside", next);
  }

  function addInsideItem() {
    updateField("whatsInside", [...form.whatsInside, { a: "", b: "" }]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMessage(null);

    if (form.whatsInside.length === 0) {
      setSaveMessage({ text: 'Add at least one "what\'s inside" item before saving.', error: true });
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
      pageCount: form.pageCount ? Number.parseInt(form.pageCount, 10) : undefined,
      chapterCount: form.chapterCount ? Number.parseInt(form.chapterCount, 10) : undefined,
      whatsInside: form.whatsInside.map((item) => ({ title: item.a.trim(), description: item.b.trim() })),
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
        const loaded = guideToForm(res.guide);
        setGuide(res.guide);
        setForm(loaded);
        setInitialPriceRupees(res.guide.pricePaise / 100);
        setLastSavedAt(res.guide.updatedAt ?? res.guide.createdAt);
        savedSnapshotRef.current = JSON.stringify(loaded);
        setMode("edit");
        window.history.replaceState(null, "", `/admin/guides/edit/?slug=${encodeURIComponent(res.guide.slug)}`);
        setSaveMessage({ text: "Guide created as a draft. Upload a cover and PDF, then publish it when it's ready." });
      } else if (guide) {
        const res = await putJson<{ guide: AdminGuideDetail }>(`/api/admin/guides/${encodeURIComponent(guide.slug)}`, payload);
        const loaded = guideToForm(res.guide);
        setGuide(res.guide);
        setForm(loaded);
        setLastSavedAt(res.guide.updatedAt ?? res.guide.createdAt);
        savedSnapshotRef.current = JSON.stringify(loaded);
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
  const priceDisplay = Number.isFinite(price) ? Math.round(price) : null;
  const compareAtDisplay = compareAt != null && Number.isFinite(compareAt) && compareAt > price ? Math.round(compareAt) : null;
  const previewCover = coverPreviewUrl ?? guide?.coverPath ?? null;
  const previewBonusCover = bonusCoverPreviewUrl ?? guide?.bonusCoverPath ?? null;
  const canUploadFiles = mode === "edit" && !!guide;

  function ButtonPreview({ className }: { className?: string }) {
    return (
      <div className="cta-button__wrap">
        <div className={["cta-button", className].filter(Boolean).join(" ")}>
          <span>
            {resolveButtonText(form.buttonText)} - ₹{priceDisplay ?? "…"}
          </span>
          <span className="cta-button__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin__edit-page">
      <form onSubmit={handleSave}>
        {/* TOP BAR — always visible, sticky on desktop; stacks + pins its
            buttons above the bottom nav on phones (see admin.css). */}
        <div className="admin__topbar">
          <div className="admin__topbar-info">
            <Link href="/admin/guides/" className="admin__edit-back">
              <BackArrowIcon /> Guides
            </Link>
            <div className="admin__topbar-title-row">
              <h1 className="admin__edit-title">{form.title.trim() || "New guide"}</h1>
              <span className={`admin__status admin__status--${form.status}`}>{form.status}</span>
            </div>
            {lastSavedAt && <p className="admin__edit-saved-line">Last saved {formatSavedAt(lastSavedAt)}</p>}
          </div>

          <div className="admin__topbar-actions">
            <button type="submit" className="admin__form-submit" disabled={saving} title={saving ? "Saving in progress" : undefined}>
              {saving ? "Saving…" : mode === "create" ? "Create guide" : "Save"}
            </button>
            {saveMessage && (
              <span className={`admin__form-message${saveMessage.error ? " admin__form-message--error" : ""}`}>{saveMessage.text}</span>
            )}
            {mode === "edit" && guide && <PublishChangesButton onPublished={() => setInitialPriceRupees(Number.parseFloat(form.priceRupees))} />}
            {mode === "edit" && guide && guide.status === "published" && (
              <a className="admin__btn-secondary" href={`${siteConfig.url}/${guide.slug}/`} target="_blank" rel="noopener noreferrer">
                View on site ↗
              </a>
            )}
            {mode === "edit" && guide && guide.status === "published" && (
              <button type="button" className="admin__danger-link" onClick={handleUnpublish} disabled={unpublishing}>
                {unpublishing ? "Unpublishing…" : "Unpublish"}
              </button>
            )}
          </div>
        </div>

        {priceChanged && (
          <p className="admin__price-warning">
            Price changes take effect at checkout immediately, but the site shows the old price until it rebuilds. Click Publish changes.
          </p>
        )}

        {/* SETTINGS — everything that isn't shown on the page itself. */}
        <section className="admin__card admin__settings-card">
          <h2 className="admin__edit-card-title">Settings</h2>
          <p className="admin__edit-card-help">Identifiers, shelf placement and the files buyers receive — none of this appears on the page below.</p>

          <div className="admin__settings-layout">
            <div className="admin__settings-fields">
              <div className="admin__edit-card-grid admin__edit-card-grid--3">
                <div className="admin__field">
                  <label htmlFor="g-slug">
                    Slug <RequiredDot />
                  </label>
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
                  <span className="admin__field-hint">
                    {mode === "edit" && guide?.slugLocked
                      ? `Locked — this guide has ${guide.totalOrders > 0 ? "orders" : "a PDF uploaded"}.`
                      : "Locks once this guide has orders or a PDF uploaded."}
                  </span>
                </div>

                <div className="admin__field">
                  <label htmlFor="g-number">Number</label>
                  <input id="g-number" type="text" placeholder="No. 05" value={form.number} onChange={(e) => updateField("number", e.target.value)} />
                </div>

                <div className="admin__field">
                  <label htmlFor="g-status">Status</label>
                  <select id="g-status" value={form.status} onChange={(e) => updateField("status", e.target.value as "draft" | "published")}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div className="admin__field">
                  <label htmlFor="g-sort">Sort order</label>
                  <input id="g-sort" type="number" step="1" value={form.sortOrder} onChange={(e) => updateField("sortOrder", e.target.value)} />
                </div>

                <div className="admin__field">
                  <label htmlFor="g-pages">
                    Page count <span className="admin__field-optional">optional</span>
                  </label>
                  <input id="g-pages" type="number" min="1" step="1" value={form.pageCount} onChange={(e) => updateField("pageCount", e.target.value)} />
                </div>

                <div className="admin__field">
                  <label htmlFor="g-chapters">
                    Chapter count <span className="admin__field-optional">optional</span>
                  </label>
                  <input
                    id="g-chapters"
                    type="number"
                    min="1"
                    step="1"
                    value={form.chapterCount}
                    onChange={(e) => updateField("chapterCount", e.target.value)}
                  />
                </div>
              </div>

              <div className="admin__edit-card-grid admin__edit-card-grid--2">
                <div className="admin__field">
                  <label htmlFor="g-blurb">
                    Shelf blurb <RequiredDot />
                  </label>
                  <textarea id="g-blurb" value={form.blurb} onChange={(e) => updateField("blurb", e.target.value)} rows={2} required />
                </div>

                <div className="admin__field">
                  <label htmlFor="g-description">Description</label>
                  <textarea id="g-description" value={form.description} onChange={(e) => updateField("description", e.target.value)} rows={2} />
                  <span className="admin__field-hint">Not shown on the guide&apos;s page.</span>
                </div>
              </div>

              {canUploadFiles && guide && (
                <div className="admin__field-group">
                  <p className="admin__card-label">PDF</p>
                  {guide.pdfPath ? (
                    <div className="admin__uploaded-row">
                      <p className="admin__file-state">Uploaded — {basename(guide.pdfPath)}</p>
                      <label htmlFor="g-pdf-file" className="admin__btn-secondary admin__file-trigger">
                        <input
                          id="g-pdf-file"
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setPdfFile(file);
                          }}
                        />
                        Replace PDF
                      </label>
                    </div>
                  ) : (
                    <FileDropzone
                      id="g-pdf-file"
                      accept="application/pdf"
                      label="Drop a PDF here, or click to choose"
                      hint="PDF only, up to 25 MB"
                      onFile={setPdfFile}
                    />
                  )}
                  {pdfFile && (
                    <div className="admin__uploaded-row">
                      <span className="admin__upload-filename">
                        {pdfFile.name} ({formatFileSize(pdfFile.size)})
                      </span>
                      <button type="button" className="admin__form-submit" onClick={() => handlePdfUpload(false)} disabled={pdfUploading}>
                        {pdfUploading ? "Uploading…" : "Upload"}
                      </button>
                    </div>
                  )}
                  {pdfMessage && (
                    <span className={`admin__form-message${pdfMessage.error ? " admin__form-message--error" : ""}`}>{pdfMessage.text}</span>
                  )}
                </div>
              )}
            </div>

            <div className="admin__settings-preview">
              <p className="admin__card-label">Shelf card preview</p>
              <div className="admin__shelf-preview-card book-card">
                <div className="book-card__cover">
                  {previewCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewCover} alt="" className="admin__shelf-preview-cover-img" />
                  ) : (
                    <span className="admin__guide-thumb--empty" aria-hidden="true" />
                  )}
                  <span className="book-card__no">{form.number || "No. --"}</span>
                  <span className="book-card__price">
                    ₹{priceDisplay ?? "…"}
                    {compareAtDisplay != null && <span className="book-card__compare-at-price">₹{compareAtDisplay}</span>}
                  </span>
                </div>
                <div>
                  <h3 className="book-card__title">{form.title.trim() || "New guide"}</h3>
                  <p className="book-card__blurb">{form.blurb.trim() || "Add a shelf blurb"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE PAGE EDITOR — the real guide page's own styles, edited in place. */}
        <div className="admin__live-page">
          <section className={`${pageStyles.hero} admin__live-hero`}>
            <div className={pageStyles.heroInner}>
              <div className={`${pageStyles.heroGrid} admin__live-hero-grid`}>
                <div className={pageStyles.heroMedia}>
                  {canUploadFiles ? (
                    <LiveImagePicker
                      id="g-cover-file"
                      accept="image/png,image/jpeg,image/webp"
                      previewSrc={previewCover}
                      uploaded={!!guide?.coverPath}
                      alt={form.title || "Cover"}
                      imgClassName={pageStyles.cover}
                      onFile={setCoverFile}
                      pendingFile={coverFile}
                      onUpload={handleCoverUpload}
                      uploading={coverUploading}
                      message={coverMessage}
                      formatFileSize={formatFileSize}
                    />
                  ) : (
                    <div className="admin__live-media">
                      <span className={`${pageStyles.cover} admin__live-media-empty`} aria-hidden="true" />
                      <p className="admin__file-state admin__file-state--empty">Save the guide first to upload a cover</p>
                    </div>
                  )}
                </div>

                <div className={`${pageStyles.heroText} admin__live-hero-text`}>
                  <LiveField
                    value={form.badge}
                    onChange={(v) => updateField("badge", v)}
                    placeholder="Add a badge"
                    ariaLabel="Badge"
                    className={pageStyles.badge}
                    sizeToContent
                  />

                  <LiveField
                    value={form.title}
                    onChange={(v) => updateField("title", v)}
                    placeholder="Add a title"
                    ariaLabel="Title"
                    className={pageStyles.title}
                    multiline
                    required
                  />

                  <LiveField
                    value={form.subtitle}
                    onChange={(v) => updateField("subtitle", v)}
                    placeholder="Add a subtitle"
                    ariaLabel="Subtitle"
                    className={pageStyles.subtitle}
                    multiline
                    required
                  />

                  <div className={pageStyles.priceRow}>
                    <span className="admin__live-price-field">
                      <span className={pageStyles.price}>₹</span>
                      <LiveField
                        value={form.priceRupees}
                        onChange={(v) => updateField("priceRupees", v)}
                        placeholder="Add a price"
                        ariaLabel="Price in rupees"
                        className={pageStyles.price}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="decimal"
                        required
                        sizeToContent
                      />
                    </span>
                    <span className="admin__live-price-field">
                      <span className={pageStyles.compareAtPrice}>₹</span>
                      <LiveField
                        value={form.compareAtPriceRupees}
                        onChange={(v) => updateField("compareAtPriceRupees", v)}
                        placeholder="Compare-at"
                        ariaLabel="Compare-at price in rupees"
                        className={pageStyles.compareAtPrice}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="decimal"
                        sizeToContent
                      />
                    </span>
                  </div>

                  <div className="admin__live-button-col">
                    <div className="cta-button__wrap">
                      <div className="cta-button admin__live-button">
                        <LiveField
                          value={form.buttonText}
                          onChange={(v) => updateField("buttonText", v)}
                          placeholder={DEFAULT_BUTTON_TEXT}
                          ariaLabel="Buy button text"
                          className="admin__live-button-text"
                          maxLength={BUTTON_TEXT_MAX_LENGTH}
                          sizeToContent
                        />
                        <span className="admin__live-button-suffix"> - ₹{priceDisplay ?? "…"}</span>
                        <span className="cta-button__arrow" aria-hidden="true">
                          →
                        </span>
                      </div>
                    </div>
                    <span className="admin__live-counter">
                      {form.buttonText.length}/{BUTTON_TEXT_MAX_LENGTH}
                    </span>
                  </div>

                  <div className={`bonus-card-wrap admin__live-bonus-wrap${form.bonusEnabled ? "" : " admin__live-bonus-wrap--off"}`}>
                    <div className="bonus-card">
                      <span className="bonus-card__tag">Free</span>
                      <LiveSwitch checked={form.bonusEnabled} onChange={(v) => updateField("bonusEnabled", v)} ariaLabel="Show the free bonus on the guide page" />
                      <div className="bonus-card__media">
                        {canUploadFiles ? (
                          <LiveImagePicker
                            id="g-bonus-cover-file"
                            accept="image/png,image/jpeg,image/webp"
                            previewSrc={previewBonusCover}
                            uploaded={!!guide?.bonusCoverPath}
                            alt="Bonus cover"
                            imgClassName="bonus-card__cover"
                            onFile={setBonusCoverFile}
                            pendingFile={bonusCoverFile}
                            onUpload={handleBonusCoverUpload}
                            uploading={bonusCoverUploading}
                            message={bonusCoverMessage}
                            formatFileSize={formatFileSize}
                          />
                        ) : (
                          <span className="bonus-card__cover admin__live-media-empty" aria-hidden="true" />
                        )}
                      </div>
                      <div className="bonus-card__body">
                        <LiveField
                          value={form.bonusTitle}
                          onChange={(v) => updateField("bonusTitle", v)}
                          placeholder="Add a bonus title"
                          ariaLabel="Bonus title"
                          className="bonus-card__title"
                        />
                        <LiveField
                          value={form.bonusDescription}
                          onChange={(v) => updateField("bonusDescription", v)}
                          placeholder="Add a bonus description"
                          ariaLabel="Bonus description"
                          className="bonus-card__description"
                          multiline
                        />
                      </div>
                    </div>

                    {canUploadFiles && guide ? (
                      <div className="admin__bonus-pdf-row">
                        <span className={`admin__file-state${guide.bonusPdfPath ? "" : " admin__file-state--empty"}`}>
                          {guide.bonusPdfPath ? "Uploaded" : "Not uploaded yet"}
                        </span>
                        <label htmlFor="g-bonus-pdf-file" className="admin__bonus-pdf-btn admin__file-trigger">
                          <input
                            id="g-bonus-pdf-file"
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setBonusPdfFile(file);
                            }}
                          />
                          {guide.bonusPdfPath ? "Replace bonus PDF" : "Upload bonus PDF"}
                        </label>
                        {bonusPdfFile && (
                          <>
                            <span className="admin__upload-filename">
                              {bonusPdfFile.name} ({formatFileSize(bonusPdfFile.size)})
                            </span>
                            <button
                              type="button"
                              className="admin__form-submit"
                              onClick={() => handleBonusPdfUpload(false)}
                              disabled={bonusPdfUploading}
                            >
                              {bonusPdfUploading ? "Uploading…" : "Upload"}
                            </button>
                          </>
                        )}
                        {bonusPdfMessage && (
                          <span className={`admin__form-message${bonusPdfMessage.error ? " admin__form-message--error" : ""}`}>
                            {bonusPdfMessage.text}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="admin__file-state admin__file-state--empty">Save the guide first to upload a bonus PDF</p>
                    )}
                  </div>

                  {(form.pageCount || form.chapterCount) && (
                    <p className={pageStyles.formatLine}>
                      {[form.pageCount ? `${form.pageCount} pages` : null, form.chapterCount ? `${form.chapterCount} chapters` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}

                  <div className={pageStyles.trustBadges}>
                    <span>✓ Instant delivery</span>
                    <span>✓ Secure checkout</span>
                    <span>✓ PDF</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={pageStyles.insideSection}>
            <div className={pageStyles.insideInner}>
              <h2 className={pageStyles.insideHeading}>What&apos;s Inside</h2>

              <div className={pageStyles.insideList}>
                {form.whatsInside.map((item, i) => (
                  <div key={i} className={pageStyles.insideItem}>
                    <span className={pageStyles.insideItemNumber}>{String(i + 1).padStart(2, "0")}</span>
                    <div className="admin__live-inside-fields">
                      <LiveField
                        value={item.a}
                        onChange={(v) => updateInsideItem(i, "a", v)}
                        placeholder="Add a heading"
                        ariaLabel={`Heading for item ${i + 1}`}
                        className={pageStyles.insideItemTitle}
                        dark
                      />
                      <LiveField
                        value={item.b}
                        onChange={(v) => updateInsideItem(i, "b", v)}
                        placeholder="Add a description"
                        ariaLabel={`Description for item ${i + 1}`}
                        className={pageStyles.insideItemBody}
                        multiline
                        dark
                      />
                    </div>
                    <div className="admin__live-inside-actions">
                      <button
                        type="button"
                        className="admin__live-icon-btn"
                        onClick={() => moveInsideItem(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move item ${i + 1} up`}
                        title={`Move item ${i + 1} up`}
                      >
                        <ArrowUpIcon />
                      </button>
                      <button
                        type="button"
                        className="admin__live-icon-btn"
                        onClick={() => moveInsideItem(i, 1)}
                        disabled={i === form.whatsInside.length - 1}
                        aria-label={`Move item ${i + 1} down`}
                        title={`Move item ${i + 1} down`}
                      >
                        <ArrowDownIcon />
                      </button>
                      <button
                        type="button"
                        className="admin__live-icon-btn admin__live-icon-btn--danger"
                        onClick={() => removeInsideItem(i)}
                        aria-label={`Remove item ${i + 1}`}
                        title={`Remove item ${i + 1}`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="admin__live-add-item" onClick={addInsideItem}>
                <PlusIcon /> Add item
              </button>
              {form.whatsInside.length === 0 && <p className="admin__field-error-text admin__field-error-text--dark">At least one item is required.</p>}

              <ButtonPreview className={pageStyles.insideCta} />
            </div>
          </section>

          <section className={pageStyles.buySection}>
            <div className={pageStyles.buyInner}>
              <h2 className={pageStyles.buyHeading}>You are just a download away.</h2>
              <p className={pageStyles.buySub}>{form.pageCount ? `${form.pageCount} pages, ` : ""}PDF, delivered the moment you check out.</p>
              <div className={pageStyles.buyPriceRow}>
                <span className={pageStyles.buyPrice}>₹{priceDisplay ?? "…"}</span>
                {compareAtDisplay != null && <span className={pageStyles.buyCompareAtPrice}>₹{compareAtDisplay}</span>}
              </div>
              <ButtonPreview className={pageStyles.buyCta} />
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
