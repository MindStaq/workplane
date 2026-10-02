import { SidebarInset, SidebarProvider, TooltipProvider } from "@workplane/ui";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppSidebar } from "../src/components/app-sidebar";
import { AutoRefresh } from "../src/components/auto-refresh";
import { Topbar } from "../src/components/topbar";
import { loadShell } from "../src/lib/data";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Workplane — Operator Console",
    template: "%s · Workplane",
  },
  description: "Operator console for Workplane: a self-hosted control plane that schedules agent work across your own nodes.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#16181d",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const shell = await loadShell();
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar shell={shell} />
            <SidebarInset>
              <Topbar nodes={shell.nodes} operatorToken={shell.operatorToken} />
              <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 md:px-8 md:py-8">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
        <AutoRefresh />
      </body>
    </html>
  );
}
