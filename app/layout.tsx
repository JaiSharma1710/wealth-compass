import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "react-bootstrap-typeahead/css/Typeahead.bs5.css";
import { cn } from "@/lib/utils";
import { AppToaster } from "@/components/app-toaster";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

export const metadata: Metadata = {
  title: {
    default: "Wealth Compass",
    template: "%s | Wealth Compass",
  },
  description: "Track your finances with a protected Wealth Compass dashboard.",
  applicationName: "Wealth Compass",
  appleWebApp: {
    capable: true,
    title: "Wealth",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131926" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans")}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AppToaster />
        <ServiceWorkerRegistrar />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`}
        </Script>
      </body>
    </html>
  );
}
