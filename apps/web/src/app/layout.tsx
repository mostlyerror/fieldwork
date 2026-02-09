import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
    <html lang="en">
      <body className="font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
