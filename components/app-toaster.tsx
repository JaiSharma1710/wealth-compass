"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      toastOptions={{
        duration: 3500,
        className: "wc-toast",
        style: {
          background: "var(--wc-surface)",
          color: "var(--wc-ink)",
          border: "1px solid var(--wc-line)",
          borderRadius: "14px",
          padding: "10px 14px",
          fontSize: "0.875rem",
          maxWidth: "min(92vw, 420px)",
          boxShadow: "0 12px 32px rgba(16, 24, 40, 0.16)",
        },
        success: { iconTheme: { primary: "var(--wc-gain)", secondary: "var(--wc-surface)" } },
        error: { iconTheme: { primary: "var(--wc-loss)", secondary: "var(--wc-surface)" } },
      }}
    />
  );
}
