"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  StatusDot,
} from "@workplane/ui";
import { Activity, CalendarClock, LayoutDashboard, ListChecks, Server, Sparkles, Workflow, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ShellData } from "../lib/data";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton isActive={active} tooltip={item.label} render={<Link href={item.href} />}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.badge !== undefined && (
                  <SidebarMenuBadge className="font-mono text-[11px] text-muted-foreground">{item.badge}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ shell }: { shell: Pick<ShellData, "healthy" | "serverHost" | "nodes" | "activeTasks"> }) {
  const online = shell.nodes.filter((node) => node.status === "online").length;
  const operate: NavItem[] = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks", icon: ListChecks, badge: shell.healthy ? shell.activeTasks : undefined },
    { href: "/runs", label: "Runs", icon: Activity },
    { href: "/nodes", label: "Nodes", icon: Server, badge: shell.healthy ? `${online}/${shell.nodes.length}` : undefined },
  ];
  const automate: NavItem[] = [
    { href: "/workplans", label: "Workplans", icon: Workflow },
    { href: "/schedules", label: "Schedules", icon: CalendarClock },
    { href: "/skills", label: "Skills", icon: Sparkles },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                  <path d="M3 6l4.5 12L12 8l4.5 10L21 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold tracking-tight">workplane</span>
                <span className="font-mono text-[11px] text-muted-foreground">operator console · alpha</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Operate" items={operate} />
        <NavGroup label="Automate" items={automate} />
      </SidebarContent>
      <SidebarFooter>
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2.5 group-data-[collapsible=icon]:hidden"
        >
          <StatusDot status={shell.healthy ? "online" : "offline"} className="mt-1" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium">{shell.healthy ? "Control plane healthy" : "Control plane unreachable"}</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{shell.serverHost}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
