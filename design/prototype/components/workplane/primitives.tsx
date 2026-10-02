import { cn } from "@/lib/utils"
import { Cpu, Bot, SquareTerminal, type LucideIcon } from "lucide-react"

export function Capability({ name, matched, className }: { name: string; matched?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 font-mono text-[11px] leading-none",
        matched ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {name}
    </span>
  )
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs", className)}>{children}</span>
}

const kindIcons: Record<string, LucideIcon> = {
  shell: SquareTerminal,
  inference: Cpu,
  harness: Bot,
}

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = kindIcons[kind] ?? SquareTerminal
  return <Icon className={cn("size-4 text-muted-foreground", className)} aria-hidden="true" />
}

export function KindLabel({ kind, adapter }: { kind: string; adapter: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <KindIcon kind={kind} />
      <span className="text-sm capitalize">{kind}</span>
      {adapter !== kind && <span className="font-mono text-xs text-muted-foreground">{adapter}</span>}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <div className="text-xs text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-pretty text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>{children}</div>
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}
