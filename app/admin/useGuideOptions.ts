"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api";

export interface GuideOption {
  slug: string;
  title: string;
}

export function useGuideOptions(): GuideOption[] {
  const [guides, setGuides] = useState<GuideOption[]>([]);

  useEffect(() => {
    getJson<{ guides: GuideOption[] }>("/api/admin/guides", {})
      .then((data) => setGuides(data.guides))
      .catch(() => setGuides([]));
  }, []);

  return guides;
}
