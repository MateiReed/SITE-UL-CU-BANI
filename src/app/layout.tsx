import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS2 Live Radar Visualizer",
  description: "Real-time CS2 radar visualization via executor telemetry.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CS2 Radar",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090a0f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#090a0f] text-white antialiased overflow-hidden select-none" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

