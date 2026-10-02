import type { NodeRecord } from "@workplane/types";
import { Separator, SidebarTrigger } from "@workplane/ui";
import { KeyRound, Search } from "lucide-react";
import { SubmitTaskDialog } from "./submit-task-dialog";

export function Topbar({ nodes, operatorToken }: { nodes: NodeRecord[]; operatorToken: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <label className="relative hidden max-w-sm flex-1 md:block" title="Search needs a control-plane search endpoint">
        <span className="sr-only">Search tasks, runs and nodes (not available yet)</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          disabled
          placeholder="Search tasks, runs, nodes…"
          className="h-8 w-full cursor-not-allowed rounded-md border border-input bg-muted/30 pr-12 pl-8 text-sm opacity-60 outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
          <KeyRound className="size-3" aria-hidden="true" />
          {operatorToken ? "operator token" : "no token"}
        </span>
        <SubmitTaskDialog nodes={nodes} />
      </div>
    </header>
  );
}
