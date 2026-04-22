import type { Metadata } from "next";
import "./globals.css";
import MobileWarning from "@/components/MobileWarning";

export const metadata: Metadata = {
  title: "Cascade 2 — Pinellas County, FL",
  description:
    "Conversational, anticipatory emergency mapping on real public data. Sibling to cascade1.",
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('cascade-v2-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var useDark = stored ? stored === 'dark' : prefersDark;
    if (useDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <MobileWarning />
        {children}
      </body>
    </html>
  );
}
