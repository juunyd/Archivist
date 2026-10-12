"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { PencilIcon } from "../../icons";

function useAutoGrow(value: string, enabled: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, enabled]);
  return ref;
}

/**
 * Measures exactly how wide a piece of text renders in a given font, via an
 * invisible mirror in the same classes — a ch-based guess runs too wide or
 * too narrow depending on case and weight (bold uppercase vs. plain digits),
 * so anything sizing or positioning itself around short text (the price
 * field's width, the title's trailing required dot) uses this instead.
 */
function useTextWidth(text: string, active: boolean) {
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!active) return;
    const mirror = mirrorRef.current;
    if (!mirror) return;
    setWidth(mirror.getBoundingClientRect().width);
  }, [text, active]);
  return { mirrorRef, width };
}

/**
 * Finds where a wrapping field's text actually ends, so its required dot can
 * trail the last visible character on the last line — a single-line width
 * guess can't do this once text wraps. A hidden mirror (same classes, same
 * width, so it wraps identically) exposes one DOMRect per visual line via
 * getClientRects(); the last one's right/bottom edge is where the dot goes.
 */
function useTrailingDotPosition(text: string, active: boolean) {
  const echoRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const el = echoRef.current;
    const parent = el?.parentElement;
    const textNode = el?.firstChild;
    if (!el || !parent || !textNode) return;
    // el.getClientRects() would return a single box (position:absolute
    // blockifies the span, so it stops fragmenting per line) — a Range
    // over the text node itself still reports one rect per visual line
    // regardless of the ancestor's display type.
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rects = range.getClientRects();
    if (rects.length === 0) return;
    const last = rects[rects.length - 1];
    const parentRect = parent.getBoundingClientRect();
    setPos({
      left: last.right - parentRect.left + 4,
      top: last.top - parentRect.top + last.height / 2 - 2.5,
    });
  }, [text, active]);
  return { echoRef, pos };
}

interface LiveFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** Typographic class copied from the real guide page's own CSS module, so sizing matches exactly. */
  className?: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  type?: string;
  inputMode?: "decimal" | "numeric" | "text" | "email" | "none" | "tel" | "url" | "search";
  min?: string | number;
  step?: string | number;
  /** Lighter hover/placeholder treatment for fields sitting on the dark "What's Inside" section. */
  dark?: boolean;
  /** Shows a live x/max character counter beside the field (buy button text). */
  showCounter?: boolean;
  /** Sizes the input to its content (or placeholder) instead of filling its container — for short inline numbers like price. */
  sizeToContent?: boolean;
  id?: string;
}

/**
 * An inline-editable piece of text that looks like the real guide page's
 * copy until you interact with it: soft outline + pencil on hover, red
 * outline while focused, grey placeholder when empty. Visual only — every
 * value/onChange pair here is the same form state GuideEditContent already
 * saves, uploads and validates.
 */
export function LiveField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  multiline,
  required,
  maxLength,
  type = "text",
  inputMode,
  min,
  step,
  dark,
  showCounter,
  sizeToContent,
  id,
}: LiveFieldProps) {
  const textareaRef = useAutoGrow(value, !!multiline);
  const wrapClass = `admin__live-field${dark ? " admin__live-field--dark" : ""}${sizeToContent ? " admin__live-field--size-to-content" : ""}`;
  const fieldClass = [className, "admin__live-field-el"].filter(Boolean).join(" ");

  // Size-to-content fields (price, badge, button text) hug their text, so
  // their dot pins to the box's own corner; a wrapping required field
  // (title, subtitle) needs the last-line position computed below instead.
  const needsTrailingDot = !!required && !!multiline && !sizeToContent;
  const { mirrorRef, width: textWidth } = useTextWidth(value || placeholder, !!sizeToContent);
  const { echoRef, pos: trailingDotPos } = useTrailingDotPosition(value || placeholder, needsTrailingDot);

  const sizeStyle = sizeToContent ? { width: `${textWidth + 8}px` } : undefined;

  return (
    <span className={wrapClass}>
      {multiline ? (
        <textarea
          id={id}
          ref={textareaRef}
          className={fieldClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          required={required}
          maxLength={maxLength}
          rows={1}
        />
      ) : (
        <input
          id={id}
          type={type}
          className={fieldClass}
          style={sizeStyle}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          required={required}
          maxLength={maxLength}
          inputMode={inputMode}
          min={min}
          step={step}
        />
      )}
      <PencilIcon className="admin__live-pencil" />
      {sizeToContent && (
        <span
          ref={mirrorRef}
          aria-hidden="true"
          className={fieldClass}
          style={{ position: "absolute", visibility: "hidden", whiteSpace: "pre", width: "auto", height: 0, top: 0, left: 0 }}
        >
          {value || placeholder}
        </span>
      )}
      {needsTrailingDot && (
        <span
          ref={echoRef}
          aria-hidden="true"
          className={fieldClass}
          style={{ position: "absolute", visibility: "hidden", inset: 0, width: "100%", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}
        >
          {value || placeholder}
        </span>
      )}
      {needsTrailingDot
        ? trailingDotPos && (
            <span
              className="admin__live-field-required-dot admin__live-field-required-dot--trailing"
              aria-hidden="true"
              style={{ left: trailingDotPos.left, top: trailingDotPos.top }}
            />
          )
        : required && <span className="admin__live-field-required-dot" aria-hidden="true" />}
      {showCounter && maxLength != null && (
        <span className="admin__live-counter">
          {value.length}/{maxLength}
        </span>
      )}
    </span>
  );
}

interface LiveImagePickerProps {
  id: string;
  accept: string;
  previewSrc: string | null;
  uploaded: boolean;
  alt: string;
  imgClassName: string;
  onFile: (file: File) => void;
  pendingFile: File | null;
  onUpload: () => void;
  uploading: boolean;
  message: { text: string; error?: boolean } | null;
  formatFileSize: (bytes: number) => string;
  /** Renders only the clickable/droppable image itself, with none of the
   * "Uploaded"/pending/message text underneath — for a card (like the free
   * bonus's) that must match the live page exactly; that status lives in a
   * side-panel card elsewhere on the same page instead. */
  minimal?: boolean;
}

/** Click-or-drop image picker, overlaid directly on the cover/bonus-cover art instead of a separate dropzone box. */
export function LiveImagePicker({
  id,
  accept,
  previewSrc,
  uploaded,
  alt,
  imgClassName,
  onFile,
  pendingFile,
  onUpload,
  uploading,
  message,
  formatFileSize,
  minimal,
}: LiveImagePickerProps) {
  return (
    <div className="admin__live-media">
      <label
        htmlFor={id}
        className="admin__live-media-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
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
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt={alt} className={imgClassName} />
        ) : (
          <span className={`${imgClassName} admin__live-media-empty`} aria-hidden="true" />
        )}
        <span className="admin__live-media-overlay">
          <PencilIcon /> Click or drop to change
        </span>
      </label>
      {!minimal && (
        <>
          <p className={`admin__file-state${uploaded ? "" : " admin__file-state--empty"}`}>
            {uploaded ? "Uploaded" : "Not uploaded yet"}
          </p>
          {pendingFile && (
            <div className="admin__live-media-pending">
              <span className="admin__upload-filename">
                {pendingFile.name} ({formatFileSize(pendingFile.size)})
              </span>
              <button type="button" className="admin__form-submit" onClick={onUpload} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          )}
          {message && (
            <span className={`admin__form-message${message.error ? " admin__form-message--error" : ""}`}>{message.text}</span>
          )}
        </>
      )}
    </div>
  );
}

interface LiveSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}

/** On/Off switch for the free bonus card. */
export function LiveSwitch({ checked, onChange, ariaLabel }: LiveSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`admin__live-switch${checked ? " admin__live-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="admin__live-switch-knob" />
    </button>
  );
}
