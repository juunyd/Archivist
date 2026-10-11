"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";

interface CopyableTextProps {
  text: string;
  className?: string;
}

/** Inline text with a small copy-to-clipboard button — copies exactly what's
 * displayed, never more (e.g. the masked form of an email, not the real
 * address behind it), so it can't leak more than the page already shows. */
export function CopyableText({ text, className }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <span className={`admin__copyable ${className ?? ""}`}>
      <span>{text}</span>
      <button
        type="button"
        className="admin__copy-btn"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : `Copy ${text}`}
        title={copied ? "Copied" : "Copy"}
      >
        <CopyIcon />
      </button>
    </span>
  );
}
