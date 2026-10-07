"use client";

// The canvas address you opened is no longer in this project, so its first canvas opened instead (slice 2a): a toast
// says so, once, and the address loses its `?moved=1`.

import { useEffect, useRef } from "react";
import { useToast } from "@/ui/components/toast";

export function MovedNotice({ project, canvas }: { project: string; canvas: string }) {
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast(`This canvas is no longer in ${project}. Opened ${canvas}.`);
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast, project, canvas]);
  return null;
}
