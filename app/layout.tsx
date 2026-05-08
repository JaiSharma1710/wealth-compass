import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppToaster } from "@/components/app-toaster";

export const metadata: Metadata = {
  title: {
    default: "Wealth Compass",
    template: "%s | Wealth Compass",
  },
  description: "Track your finances with a protected Wealth Compass dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", "font-sans")}>
      <body className="min-h-full flex flex-col">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
