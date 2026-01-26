import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { ThemeSync } from "@/components/theme-sync";
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
                })();
              `,
            }}
          />
        </head>
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
        >
          <ThemeSync />
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
