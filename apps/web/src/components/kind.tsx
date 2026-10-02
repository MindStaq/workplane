import { cn } from "@workplane/ui";
import { Bot, Cpu, SquareTerminal, type LucideIcon } from "lucide-react";
import { kindGroup, type KindGroup } from "../lib/derive";

const icons: Record<KindGroup, LucideIcon> = {
  shell: SquareTerminal,
  inference: Cpu,
  harness: Bot,
  other: SquareTerminal,
};

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = icons[kindGroup({ kind })];
  return <Icon className={cn("size-4 text-muted-foreground", className)} aria-hidden="true" />;
}

export function KindLabel({ kind, adapter }: { kind: string; adapter: string }) {
  const group = kindGroup({ kind });
  return (
    <span className="inline-flex items-center gap-2">
      <KindIcon kind={kind} />
      <span className="text-sm capitalize">{group === "other" ? kind : group}</span>
      {adapter !== group && <span className="font-mono text-xs text-muted-foreground">{adapter}</span>}
    </span>
  );
}
