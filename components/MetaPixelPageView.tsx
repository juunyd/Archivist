"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID } from "@/lib/meta-pixel";

/**
 * Fires PageView on client-side route changes. The inline script in
 * MetaPixel.tsx already covers the first load of any page, so this skips its
 * own first render and only fires on the pathname changes after that.
 */
export function MetaPixelPageView() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
