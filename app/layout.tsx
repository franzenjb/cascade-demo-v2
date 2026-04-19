import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cascade Demo V2 — Hillsborough County, FL",
  description:
    "Conversational, anticipatory emergency mapping on real public data. Sibling to cascade-demo.",
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
      <body>{children}</body>
    </html>
  );
}
