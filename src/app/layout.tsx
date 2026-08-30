import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "SATLens",
  description:
    "Find out why you keep missing the same kinds of SAT questions -- and fix it.",
};

/** Applied before paint so a dark-mode reload never flashes white. */
const THEME_BOOTSTRAP = `
try {
  var t = localStorage.getItem('satlens-theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
