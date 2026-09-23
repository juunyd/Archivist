"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { FunctionError, postJson } from "@/lib/api";

interface DownloadReady {
  guideTitle: string;
  fileName: string;
  objectUrl: string;
  downloadsRemaining: number;
}

type View = "loading" | "ready" | "invalid" | "exhausted" | "error";

/** j***@example.com-shaped filename fallback if Content-Disposition is ever missing. */
const FILENAME_FROM_DISPOSITION = /filename="([^"]+)"/;

/**
 * Opening this page spends one of the ten downloads the order allows — same
 * as before, just for a different reason now: R2 has no Supabase-style
 * signed URL, so /api/download does the atomic claim and streams the PDF
 * bytes in the same request, and this is the only way to reach them. The
 * fetch happens on load; the button underneath just saves the bytes already
 * in memory, so clicking it costs nothing further server-side.
 */
export function DownloadContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [view, setView] = useState<View>("loading");
  const [download, setDownload] = useState<DownloadReady | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setView("invalid");
      return;
    }

    let cancelled = false;

    (async () => {
      let response: Response;
      try {
        response = await fetch(`/api/download?token=${encodeURIComponent(token)}`);
      } catch {
        if (cancelled) return;
        setMessage("We could not reach the server. Check your connection and try again.");
        setView("error");
        return;
      }

      if (cancelled) return;

      if (!response.ok) {
        let code: string | undefined;
        let errorMessage: string | undefined;
        try {
          const body = await response.json() as { error?: { code?: string; message?: string } };
          code = body?.error?.code;
          errorMessage = body?.error?.message;
        } catch {
          // Non-JSON error body: fall through to the generic "error" view.
        }
        if (cancelled) return;
        setMessage(errorMessage ?? null);
        if (code === "download_limit_reached") setView("exhausted");
        else if (code === "invalid_token") setView("invalid");
        else setView("error");
        return;
      }

      const remainingHeader = response.headers.get("X-Downloads-Remaining");
      const titleHeader = response.headers.get("X-Guide-Title");
      const dispositionMatch = FILENAME_FROM_DISPOSITION.exec(
        response.headers.get("Content-Disposition") ?? "",
      );

      const blob = await response.blob();
      if (cancelled) return;

      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      setDownload({
        guideTitle: titleHeader ? decodeURIComponent(titleHeader) : "your Archivist guide",
        fileName: dispositionMatch?.[1] ?? "guide.pdf",
        objectUrl,
        downloadsRemaining: remainingHeader ? Number(remainingHeader) : 0,
      });
      setView("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // The blob URL only exists in this tab's memory — release it on unmount
  // (or if the token ever changes) rather than leaking it.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const support = (
    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
  );

  return (
    <>
      {view === "loading" && (
        <p className="download__body">Preparing your download&hellip;</p>
      )}

      {view === "ready" && download && (
        <>
          <p className="download__eyebrow">Your guide</p>
          <h2 className="download__title">{download.guideTitle}</h2>
          {/*
            A blob: URL, not a redirect to the Worker — the file is already
            in memory, so the browser's own `download` attribute (which only
            works same-origin or on a blob/data URL, unlike the old signed
            Supabase URL) is what saves it. No target="_blank" needed either.
          */}
          <a
            className="cta-button download__cta"
            href={download.objectUrl}
            download={download.fileName}
            rel="noopener"
          >
            <span>Download the PDF</span>
            <span className="cta-button__arrow" aria-hidden="true">
              ↓
            </span>
          </a>
          <p className="download__note">
            Reload this page any time for a fresh copy. You can open this page{" "}
            {download.downloadsRemaining} more{" "}
            {download.downloadsRemaining === 1 ? "time" : "times"}.
          </p>
        </>
      )}

      {view === "invalid" && (
        <p className="download__body">
          This download link isn&apos;t valid. It may have been mistyped or cut
          short by an email client. Request a fresh one below.
        </p>
      )}

      {view === "exhausted" && (
        <p className="download__body">
          {message ??
            "This link has been used its maximum number of times."}{" "}
          Write to {support} and we will restore it.
        </p>
      )}

      {view === "error" && (
        <p className="download__body">
          {message ?? "Something went wrong opening this download."} Please try
          again in a moment, or write to {support}.
        </p>
      )}

      <ResendForm />

      <Link href="/" className="thank-you__link download__home">
        Back to Archivist
      </Link>
    </>
  );
}

/**
 * Asks for the buyer's email and re-sends whatever they have bought. The
 * backend answers the same way for an address that has bought nothing, so
 * this form cannot be used to find out who our customers are.
 */
function ResendForm() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setResult(null);
    try {
      const response = await postJson<{ message: string }>("/api/resend-link", { email });
      setResult(response.message);
    } catch (error) {
      setResult(
        error instanceof FunctionError
          ? error.message
          : "We could not send that just now. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="download__resend" onSubmit={onSubmit}>
      <h3 className="download__resend-heading">Lost your link?</h3>
      <p className="download__resend-body">
        Enter the email you bought with and we will send your download links
        again.
      </p>
      <div className="download__resend-row">
        <label className="visually-hidden" htmlFor="resend-email">
          Email address
        </label>
        <input
          id="resend-email"
          className="download__input"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
        <button
          type="submit"
          className="download__submit"
          disabled={sending}
          aria-busy={sending}
        >
          {sending ? "Sending…" : "Send links"}
        </button>
      </div>
      {result && (
        <p className="download__result" role="status">
          {result}
        </p>
      )}
    </form>
  );
}
