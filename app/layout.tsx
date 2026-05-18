import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "react-bootstrap-typeahead/css/Typeahead.css";
import "react-bootstrap-typeahead/css/Typeahead.bs5.css";
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
    <html
      lang="en"
      className={cn("h-full", "antialiased", "font-sans")}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AppToaster />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("theme")==="dark"){document.documentElement.classList.add("dark")}else{document.documentElement.classList.remove("dark")}}catch{}`}
        </Script>
      </body>
    </html>
  );
}
