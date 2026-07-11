import type { Metadata } from "next";
import "./globals.css";
import Navigation from "./components/Navigation";

export const metadata: Metadata = {
  title: "The MMA Formula",
  description: "UFC fight predictions built on a custom analytical formula",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navigation />
        <div style={{ flex: 1 }}>{children}</div>
      </body>
    </html>
  );
}