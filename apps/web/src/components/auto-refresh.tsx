"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps server-rendered views live. Every interval it asks Next.js to re-run the page's server
 * components (which re-read the control plane) while preserving client state such as filters.
 * It pauses while the tab is hidden. Server-sent events can replace this later.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
