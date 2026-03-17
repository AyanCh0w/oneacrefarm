import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { ThemeSync } from "@/components/theme-sync";
import { Button } from "@/components/ui/button";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crop Logger",
  description: "One Acre Farm Crop Logger",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Crop Logger",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#34d399",
          borderRadius: "0.45rem",
        },
        elements: {
          card: "bg-card border border-border shadow-lg",
          formButtonPrimary: "bg-primary hover:bg-primary/90",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="apple-touch-icon" href="/appicons/Assets.xcassets/AppIcon.appiconset/180.png" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  } catch (e) {}
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
                    });
                  }
                })();
              `,
            }}
          />
        </head>
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
        >
          <ThemeSync />
          <Providers>
            <div className="flex min-h-screen flex-col">
              <main className="flex-1">{children}</main>
              <footer className="border-t border-border/60 bg-card/40">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-2xl space-y-2">
                      <p className="text-sm font-semibold text-foreground">
                        One Acre Farm Crop Logger
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Built for quick field logging with planting data synced
                        from Google Sheets. Spreadsheet access stays read-only,
                        and your original sheets are never modified by the app.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button asChild variant="outline" className="justify-center">
                        <Link href="/dashboard">Dashboard</Link>
                      </Button>
                      <Button asChild variant="secondary" className="justify-center">
                        <Link href="/log-data">Log Data</Link>
                      </Button>
                      <Button asChild variant="destructive" className="justify-center">
                        <Link href="/help">Help</Link>
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      Field and bed data come from synced spreadsheet tabs and
                      are optimized for fast mobile use.
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      Quality logs are stored in the app database so teams can
                      track crop observations over time.
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      Need setup help or want to review how data is handled?
                      The in-app Help page covers the workflow and privacy
                      details.
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
