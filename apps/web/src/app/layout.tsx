import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { DevIndicator } from "@/components/dev-indicator";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pickleradar.app"),
  title: "PickleRadar — Houston Pickleball Tournaments",
  description:
    "Find and register for pickleball tournaments in the Houston area. Browse upcoming events, filter by skill level, and discover tournaments on the map.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="font-nunito text-gray-900 antialiased">
        {children}
        <Analytics />
        <DevIndicator />
      </body>
    </html>
  );
}
