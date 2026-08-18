import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS2 Live Radar Visualizer",
  description: "Real-time CS2 radar visualization via executor telemetry.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-950 text-white antialiased overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
