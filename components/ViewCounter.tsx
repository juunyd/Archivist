"use client";

import { useEffect } from "react";

const SESSION_KEY_PREFIX = "archivist:viewed:";

/**
 * Counts one guide page view per browser tab session, for the admin
 * Overview funnel (see worker/routes/track-view.ts). No cookies, no IP, no
 * personal data — just a slug. Never throws and never blocks rendering: if
 * sessionStorage or the network call fails, the guide page carries on
 * exactly as normal.
 */
export function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `${SESSION_KEY_PREFIX}${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Privacy mode or storage disabled — fall through and count this one
      // view anyway; it just can't be deduped against a same-tab refresh.
    }

    fetch("/api/track/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {
      // A dropped view count is never worth surfacing to the visitor.
    });
    // Intentionally track only on mount, keyed by slug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return null;
}
