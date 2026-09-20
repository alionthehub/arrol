import type { Metadata } from "next";
import { Barlow_Condensed, Share_Tech_Mono } from "next/font/google";
import { HudAtmosphere } from "@/components/hud/atmosphere";
import { crtEffectsFromCookie } from "@/lib/session";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-hud",
  display: "swap",
});

const share = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hud-mono",
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
  const fxOn = await crtEffectsFromCookie(true);

  return (
    <html
      lang="en"
      data-fx={fxOn ? "on" : "off"}
      data-crt={fxOn ? "on" : "off"}
      className={`${barlow.variable} ${share.variable} h-full bg-hud antialiased`}
    >
      <body className="min-h-full bg-hud font-sans text-ink">
        <HudAtmosphere />
        {children}
      </body>
    </html>
  );
}
