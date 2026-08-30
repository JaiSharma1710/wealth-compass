"use client";

import { LoaderCircle } from "lucide-react";

export function PageLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[#f5f7fb] px-4 py-6 sm:px-6">
      <div className="flex min-h-[16rem] w-full max-w-xl flex-col items-center justify-center rounded-[2rem] border border-[#dce4f0] bg-white p-8 text-center shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-[#f8fbff] text-[#173d7a]">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-semibold text-[#34425a]">{label}</p>
        <div className="mt-6 grid w-full gap-2">
          <div className="h-2 rounded-full bg-[#edf2f7]" />
          <div className="mx-auto h-2 w-4/5 rounded-full bg-[#edf2f7]" />
        </div>
      </div>
    </div>
  );
}
