"use client";

import { useEffect } from "react";
import type { Guide } from "@/lib/guides";
import { trackViewContent } from "@/lib/meta-pixel";

interface GuideViewTrackerProps {
  guide: Pick<Guide, "slug" | "title" | "price">;
}

/** Fires Meta's ViewContent once, when a guide page is opened. */
export function GuideViewTracker({ guide }: GuideViewTrackerProps) {
  useEffect(() => {
    trackViewContent({
      content_ids: [guide.slug],
      content_name: guide.title,
      content_type: "product",
      value: guide.price,
      currency: "INR",
    });
    // Intentionally track only on mount, keyed by slug — not on every
    // re-render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.slug]);

  return null;
}
