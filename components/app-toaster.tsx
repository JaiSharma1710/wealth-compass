"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "#111111",
          color: "#ffffff",
          borderRadius: "16px",
          padding: "12px 14px",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.14)",
        },
        success: {
          style: {
            background: "#111111",
            color: "#ffffff",
          },
        },
        error: {
          style: {
            background: "#7f1d1d",
            color: "#ffffff",
          },
        },
      }}
    />
  );
}
