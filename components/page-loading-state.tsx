"use client";

import { LoaderCircle } from "lucide-react";

export function PageLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[#f5f7fb] px-6">
      <div className="flex min-h-[18rem] w-full max-w-3xl flex-col items-center justify-center rounded-[28px] border border-[#dce4f0] bg-white text-center shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <LoaderCircle className="h-7 w-7 animate-spin text-[#173d7a]" />
        <p className="mt-4 text-sm font-semibold text-[#34425a]">{label}</p>
      </div>
    </div>
  );
}
