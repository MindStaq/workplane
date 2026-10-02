"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  CalendarClock,
  LayoutDashboard,
  ListChecks,
  Server,
  Sparkles,
  Workflow,
} from "lucide-react"
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
} from "@/components/ui/sidebar"
import { CONTROL_PLANE, nodes, tasks } from "@/lib/mock-data"
import { StatusDot } from "./status-badge"

const activeCount = tasks.filter((t) => t.status === "running" || t.status === "assigned").length
const onlineNodes = nodes.filter((n) => n.status === "online").length

const operate = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks, badge: activeCount },
  { href: "/runs", label: "Runs", icon: Activity },
  { href: "/nodes", label: "Nodes", icon: Server, badge: `${onlineNodes}/${nodes.length}` },
]

const automate = [
  { href: "/workplans", label: "Workplans", icon: Workflow },
  { href: "/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/skills", label: "Skills", icon: Sparkles },
]

function NavGroup({ label, items }: { label: string; items: typeof operate }) {
  const pathname = usePathname()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
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
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar() {
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
                <span className="font-mono text-[11px] text-muted-foreground">v{CONTROL_PLANE.version} · alpha</span>
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
        <div className="flex items-start gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2.5 group-data-[collapsible=icon]:hidden">
          <StatusDot status="online" className="mt-1" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium">Control plane healthy</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{CONTROL_PLANE.url.replace("http://", "")}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {CONTROL_PLANE.database} · {CONTROL_PLANE.databasePath}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
