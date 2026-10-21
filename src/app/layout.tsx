import type { Metadata } from "next";
import { Montserrat, Space_Mono } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/globals.css";

// Brand type: Montserrat for display, UI and body; Space Mono for labels and status.
const montserrat = Montserrat({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Command Center",
  description: "The Clicks to Closes client portal and AI command center.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${montserrat.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
