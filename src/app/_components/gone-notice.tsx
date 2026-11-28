"use client";

// A place that no longer exists opened what still does (slice 6b): a toast says so, once, and the address loses its
// `?gone=`.

import { useEffect, useRef } from "react";
import { useToast } from "@/ui/components/toast";

/** `drop`: more of the address's parameters that said what is gone (slice 39: InfoCatalog's `item`). */
export function GoneNotice({ message, drop = [] }: { message: string; drop?: readonly string[] }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast(message);
    const url = new URL(window.location.href);
    url.searchParams.delete("gone");
    for (const p of drop) url.searchParams.delete(p);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [toast, message, drop]);
  return null;
}
