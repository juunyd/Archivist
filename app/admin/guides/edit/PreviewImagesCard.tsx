"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "../../icons";

export interface PreviewImage {
  path: string;
  caption: string | null;
}

interface PreviewImagesCardProps {
  slug: string;
  previewImages: PreviewImage[];
  onChange: (previewImages: PreviewImage[]) => void;
}

const MAX_PREVIEW_IMAGES = 8;
const ACCEPT = "image/png,image/jpeg,image/webp";

function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}

type Message = { text: string; error?: boolean } | null;

async function parseGuideResponse(res: Response): Promise<{ previewImages: PreviewImage[] }> {
  const body = (await res.json()) as { guide?: { previewImages?: PreviewImage[] }; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? "Something went wrong. Please try again.");
  return { previewImages: body.guide?.previewImages ?? [] };
}

/**
 * The "Preview pages" side-panel card: add several extra gallery images at
 * once, reorder/caption/remove them. Each action persists immediately (same
 * immediate-save pattern as the cover/PDF uploads elsewhere on this page) —
 * there's no separate "Save" step for this card.
 */
export function PreviewImagesCard({ slug, previewImages, onChange }: PreviewImagesCardProps) {
  const [uploading, setUploading] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const remaining = MAX_PREVIEW_IMAGES - previewImages.length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMessage(null);

    if (files.length > remaining) {
      setMessage({
        text: `This guide already has ${previewImages.length} preview image${previewImages.length === 1 ? "" : "s"}, and can take ${remaining} more (${MAX_PREVIEW_IMAGES} max). You picked ${files.length}.`,
        error: true,
      });
      return;
    }

    const body = new FormData();
    for (const file of Array.from(files)) body.append("files", file);

    setUploading(true);
    try {
      const res = await fetch(`/api/admin/guides/${encodeURIComponent(slug)}/preview-images`, {
        method: "POST",
        body,
      });
      const { previewImages: next } = await parseGuideResponse(res);
      onChange(next);
      setMessage({ text: `Added ${files.length} image${files.length === 1 ? "" : "s"}.` });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not upload the images.", error: true });
    } finally {
      setUploading(false);
    }
  }

  async function persistOrder(next: PreviewImage[]) {
    const res = await fetch(`/api/admin/guides/${encodeURIComponent(slug)}/preview-images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    });
    const { previewImages: saved } = await parseGuideResponse(res);
    onChange(saved);
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= previewImages.length) return;
    const next = previewImages.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setBusyPath(previewImages[index].path);
    setMessage(null);
    try {
      await persistOrder(next);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not reorder the images.", error: true });
    } finally {
      setBusyPath(null);
    }
  }

  async function handleCaptionBlur(path: string, rawCaption: string) {
    const trimmed = rawCaption.trim();
    const current = previewImages.find((img) => img.path === path);
    if (!current || (current.caption ?? "") === trimmed) return;
    const next = previewImages.map((img) => (img.path === path ? { ...img, caption: trimmed || null } : img));
    setBusyPath(path);
    setMessage(null);
    try {
      await persistOrder(next);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not save the caption.", error: true });
    } finally {
      setBusyPath(null);
    }
  }

  async function handleRemove(path: string) {
    const ok = window.confirm("Remove this preview image? This cannot be undone.");
    if (!ok) return;
    setBusyPath(path);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/guides/${encodeURIComponent(slug)}/preview-images/${encodeURIComponent(basename(path))}`, {
        method: "DELETE",
      });
      const { previewImages: next } = await parseGuideResponse(res);
      onChange(next);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not remove the image.", error: true });
    } finally {
      setBusyPath(null);
    }
  }

  return (
    <div className="admin__field-group">
      {previewImages.length > 0 && (
        <ul className="admin__preview-image-list">
          {previewImages.map((image, index) => (
            <li key={image.path} className="admin__preview-image-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.path} alt="" className="admin__preview-image-thumb" />
              <div className="admin__preview-image-fields">
                <input
                  type="text"
                  defaultValue={image.caption ?? ""}
                  onBlur={(e) => handleCaptionBlur(image.path, e.target.value)}
                  placeholder="Optional caption"
                  aria-label={`Caption for preview image ${index + 1}`}
                  maxLength={160}
                  disabled={busyPath === image.path}
                />
              </div>
              <div className="admin__preview-image-actions">
                <button
                  type="button"
                  className="admin__live-icon-btn"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0 || busyPath !== null}
                  aria-label={`Move image ${index + 1} up`}
                  title="Move up"
                >
                  <ArrowUpIcon />
                </button>
                <button
                  type="button"
                  className="admin__live-icon-btn"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === previewImages.length - 1 || busyPath !== null}
                  aria-label={`Move image ${index + 1} down`}
                  title="Move down"
                >
                  <ArrowDownIcon />
                </button>
                <button
                  type="button"
                  className="admin__live-icon-btn admin__live-icon-btn--danger"
                  onClick={() => handleRemove(image.path)}
                  disabled={busyPath !== null}
                  aria-label={`Remove image ${index + 1}`}
                  title="Remove"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <label htmlFor="g-preview-images-file" className={`admin__dropzone admin__dropzone--compact${uploading ? " admin__dropzone--disabled" : ""}`}>
          <input
            id="g-preview-images-file"
            type="file"
            accept={ACCEPT}
            multiple
            disabled={uploading}
            onChange={(e) => {
              const { files } = e.target;
              handleFiles(files);
              e.target.value = "";
            }}
          />
          <span className="admin__dropzone-label">{uploading ? "Uploading…" : "Add preview pages"}</span>
          <span className="admin__dropzone-hint">
            PNG, JPEG or WebP, 2 MB each — {remaining} more can be added ({MAX_PREVIEW_IMAGES} max)
          </span>
        </label>
      ) : (
        <p className="admin__file-state admin__file-state--empty">Maximum of {MAX_PREVIEW_IMAGES} preview images reached.</p>
      )}

      {message && <span className={`admin__form-message${message.error ? " admin__form-message--error" : ""}`}>{message.text}</span>}
    </div>
  );
}
