import type { Metadata } from "next";
import { Geist_Mono, Heebo, IBM_Plex_Sans_Arabic, Secular_One } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

// One family for Latin and Hebrew, so a line that mixes the two (a patient's
// name beside "L4–L5") does not change voice halfway. See DESIGN.md.
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
});

// Display only: names and numerals on the cobalt plate, a sum in a form.
const secularOne = Secular_One({
  variable: "--font-secular",
  subsets: ["latin", "hebrew"],
  weight: "400",
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ניהול מרפאה ותיעוד רפואי · Clinic EMR",
  description:
    "מערכת ניהול מרפאה: תיקי מטופלים, יומן, גבייה ועוד. Secure clinic workspace for records, scheduling, and billing.",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${heebo.variable} ${secularOne.variable} ${ibmPlexSansArabic.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
