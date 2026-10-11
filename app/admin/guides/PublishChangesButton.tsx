"use client";

import { useEffect, useState } from "react";
import { getJson, postJson } from "@/lib/api";

interface RebuildStatus {
  configured: boolean;
  reason: string | null;
}

interface PublishChangesButtonProps {
  /** Called after a rebuild is successfully triggered, so a caller can clear its own "price changed" warning. */
  onPublished?: () => void;
}

/**
 * Checks /api/admin/rebuild-status on mount so the button is disabled, with
 * a clear reason shown, before the admin ever clicks it — not just after a
 * failed POST. The POST route re-checks independently either way, since the
 * server never trusts this check to have actually happened.
 */
export function PublishChangesButton({ onPublished }: PublishChangesButtonProps) {
  const [rebuildStatus, setRebuildStatus] = useState<RebuildStatus | null>(null);
  const [state, setState] = useState<"idle" | "rebuilding" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setRebuildStatus(await getJson<RebuildStatus>("/api/admin/rebuild-status", {}));
      } catch {
        setRebuildStatus({ configured: false, reason: "Could not check the deploy hook's status." });
      }
    })();
  }, []);

  async function handleClick() {
    setState("rebuilding");
    setMessage(null);
    try {
      const res = await postJson<{ message: string }>("/api/admin/rebuild", {});
      setState("done");
      setMessage(res.message);
      onPublished?.();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not start the rebuild.");
    }
  }

  // Still checking — avoid flashing a disabled button that immediately enables.
  if (rebuildStatus === null) return null;

  return (
    <div className="admin__publish">
      <button
        type="button"
        className="admin__form-submit"
        onClick={handleClick}
        disabled={!rebuildStatus.configured || state === "rebuilding"}
      >
        {state === "rebuilding" ? "Rebuilding…" : "Publish changes"}
      </button>
      {!rebuildStatus.configured && (
        <p className="admin__form-message admin__form-message--error">
          {rebuildStatus.reason ?? "The deploy hook isn't configured."}
        </p>
      )}
      {rebuildStatus.configured && message && (
        <p className={`admin__form-message${state === "error" ? " admin__form-message--error" : ""}`}>{message}</p>
      )}
    </div>
  );
}
