import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { CrtOverlay } from "@/components/crt-overlay";
import { crtEffectsFromCookie } from "@/lib/session";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-arrol",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ARROL",
    template: "%s · ARROL",
  },
  description: "Arrol operations console",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const crtOn = await crtEffectsFromCookie(true);

  return (
    <html
      lang="en"
      data-crt={crtOn ? "on" : "off"}
      className={`${jetbrainsMono.variable} h-full bg-void antialiased`}
    >
      <body className="min-h-full bg-void font-mono text-phosphor">
        <CrtOverlay />
        {children}
      </body>
    </html>
  );
}
