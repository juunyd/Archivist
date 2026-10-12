"use client";

import { useLayoutEffect, useRef } from "react";
import { PencilIcon } from "../../icons";

/** Small red dot, floated at the field's corner since the live page has no label to hang it off. */
export function LiveRequiredDot() {
  return <span className="admin__live-required-dot" aria-hidden="true" />;
}

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
  const sizeStyle = sizeToContent ? { width: `${Math.max((value || placeholder || "").length, 2) + 1}ch` } : undefined;

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
