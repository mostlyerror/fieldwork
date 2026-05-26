import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { DevIndicator } from "@/components/dev-indicator";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pickleradar.app"),
  title: "PickleRadar — Houston Pickleball Tournaments",
  description:
    "Find and register for pickleball tournaments in the Houston area. Browse upcoming events, filter by skill level, and discover tournaments on the map.",
  verification: {
    google: "3nglgg09Wmul56aIjLPi4xogOSnKW0e36Yal2cQ_A-k",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans text-foreground antialiased">
        {children}
        <Analytics />
        <DevIndicator />
      </body>
    </html>
  );
}
