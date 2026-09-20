"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { getFunction, postFunction } from "@/lib/supabase-functions";

interface DownloadResponse {
  bookTitle: string;
  fileName: string;
  pdfUrl: string;
  downloadsRemaining: number;
}

type View = "loading" | "ready" | "invalid" | "exhausted" | "error";

export function DownloadContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [view, setView] = useState<View>("loading");
  const [download, setDownload] = useState<DownloadResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setView("invalid");
      return;
    }

    let cancelled = false;

    // Opening this page mints a fresh signed URL and spends one of the ten
    // downloads the order allows — hence the count shown to the buyer.
    getFunction<DownloadResponse>("get-download", { token })
      .then((data) => {
        if (cancelled) return;
        setDownload(data);
        setView("ready");
      })
      .catch((error: { code?: string; message?: string }) => {
        if (cancelled) return;
        setMessage(error?.message ?? null);
        if (error?.code === "download_limit_reached") setView("exhausted");
        else if (error?.code === "invalid_token") setView("invalid");
        else setView("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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
          <p className="download__eyebrow">Your book</p>
          <h2 className="download__title">{download.bookTitle}</h2>
          {/*
            No target="_blank": the signed URL comes back with
            Content-Disposition: attachment, so the browser saves the file
            without navigating away, and a new tab would flash empty and close
            on mobile Safari. The download attribute is a no-op cross-origin
            but costs nothing if the header is ever missing.
          */}
          <a
            className="cta-button download__cta"
            href={download.pdfUrl}
            download={download.fileName}
            rel="noopener"
          >
            <span>Download the PDF</span>
            <span className="cta-button__arrow" aria-hidden="true">
              ↓
            </span>
          </a>
          <p className="download__note">
            This link is valid for 10 minutes — reload this page for a fresh
            one. You can open this page {download.downloadsRemaining} more{" "}
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
      const response = await postFunction<{ message: string }>(
        "resend-download-link",
        { email },
      );
      setResult(response.message);
    } catch (error) {
      setResult(
        (error as { message?: string })?.message ??
          "We could not send that just now. Please try again.",
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
