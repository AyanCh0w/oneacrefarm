import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Inter, JetBrains_Mono } from "next/font/google";
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
          colorBackground: "#1c1917",
          colorInputBackground: "#292524",
          colorInputText: "#fafaf9",
          colorText: "#fafaf9",
          colorTextSecondary: "#a8a29e",
          borderRadius: "0.45rem",
        },
        elements: {
          card: "bg-card border border-border shadow-lg",
          formButtonPrimary: "bg-primary hover:bg-primary/90",
        },
      }}
    >
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
