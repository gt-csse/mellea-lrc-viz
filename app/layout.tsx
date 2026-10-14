import type { Metadata } from "next";
import "./globals.css";
import Nav from "./nav";

export const metadata: Metadata = {
  title: "Mellea · Legal citation review",
  description: "Review legal authorities, citation content, and the complete history of a saved Document."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
