import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GradPath",
  description: "Discover research, meet faculty, and build your graduate journey.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
