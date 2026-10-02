import type { ReactNode } from "react";
import "@workplane/ui/tokens.css";
import "./globals.css";

export const metadata = {
  title: "Workplane",
  description: "Operator console for the Workplane control plane",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
