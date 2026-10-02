import { KeyRound, Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { SubmitTaskDialog } from "./submit-task-dialog"

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <label className="relative hidden max-w-sm flex-1 md:block">
        <span className="sr-only">Search tasks, runs and nodes</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search tasks, runs, nodes…"
          className="h-8 w-full rounded-md border border-input bg-muted/30 pr-12 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">
          /
        </kbd>
      </label>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">
          <KeyRound className="size-3" aria-hidden="true" />
          operator token
        </span>
        <SubmitTaskDialog />
      </div>
    </header>
  )
}
