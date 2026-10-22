"use client";

// A place that no longer exists opened what still does (slice 6b): a toast says so, once, and the address loses its
// `?gone=`.

import { useEffect, useRef } from "react";
import { useToast } from "@/ui/components/toast";

export function GoneNotice({ message }: { message: string }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast(message);
    const url = new URL(window.location.href);
    url.searchParams.delete("gone");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [toast, message]);
  return null;
}
