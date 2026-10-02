import type { ReactNode } from "react";
import { cn } from "../lib/utils.js";

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
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs", className)}>{children}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
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
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>{children}</div>;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}
