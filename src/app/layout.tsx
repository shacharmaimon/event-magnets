import type { Metadata } from "next";
import "./globals.css";
import { labels } from "@/lib/labels";

// The browser tab title and the description search engines / link previews use.
export const metadata: Metadata = {
  title: labels.site.title,
  description: labels.site.description,
};

// RootLayout wraps every page in the app. Setting lang="he" and dir="rtl" here
// makes the ENTIRE site right-to-left — the correct direction for Hebrew.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* Heebo — a clean typeface designed for Hebrew. Loaded via a standard
            stylesheet link (reliable across bundlers). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
