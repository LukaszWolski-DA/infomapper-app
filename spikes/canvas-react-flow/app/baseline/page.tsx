"use client";

import dynamic from "next/dynamic";

const Baseline = dynamic(() => import("@/baseline/Baseline"), { ssr: false });

export default function Page() {
  return <Baseline />;
}
