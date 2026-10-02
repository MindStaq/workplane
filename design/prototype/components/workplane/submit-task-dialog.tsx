"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { nodes } from "@/lib/mock-data"
import { Capability } from "./primitives"
import { StatusDot } from "./status-badge"

type Kind = "shell" | "inference" | "harness"
const harnesses = ["claude-code", "codex", "aider"] as const

export function SubmitTaskDialog({ triggerLabel = "Submit task" }: { triggerLabel?: string }) {
  const [kind, setKind] = useState<Kind>("shell")
  const [harness, setHarness] = useState<(typeof harnesses)[number]>("claude-code")
  const [extraRequires, setExtraRequires] = useState("git")
  const [interactive, setInteractive] = useState(true)

  const requires = useMemo(() => {
    const base = kind === "shell" ? ["shell"] : kind === "inference" ? ["ollama"] : [harness]
    const extra = extraRequires
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return Array.from(new Set([...base, ...extra]))
  }, [kind, harness, extraRequires])

  const eligible = nodes.filter((n) => requires.every((r) => n.capabilities.includes(r)))

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus data-icon="inline-start" />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Submit a task</DialogTitle>
          <DialogDescription>
            Tasks queue on the control plane and are claimed by the first eligible node that matches every required capability.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <TabsList className="w-full">
              <TabsTrigger value="shell">Shell</TabsTrigger>
              <TabsTrigger value="inference">Inference</TabsTrigger>
              <TabsTrigger value="harness">Harness</TabsTrigger>
            </TabsList>
          </Tabs>

          {kind === "shell" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cmd">Command</Label>
              <Input id="cmd" className="font-mono" placeholder="pnpm test" defaultValue="pnpm test:nx" />
            </div>
          )}

          {kind === "inference" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" className="font-mono" defaultValue="llama3.2" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea id="prompt" rows={3} placeholder="Explain this stack trace…" />
              </div>
            </>
          )}

          {kind === "harness" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Harness</span>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Harness">
                  {harnesses.map((h) => (
                    <button
                      key={h}
                      type="button"
                      role="radio"
                      aria-checked={harness === h}
                      onClick={() => setHarness(h)}
                      className="rounded-md border border-border px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-muted aria-checked:border-primary/60 aria-checked:bg-primary/10 aria-checked:text-primary"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="repo">Repository</Label>
                <Input id="repo" className="font-mono" defaultValue="git@github.com:MindStaq/workplane.git" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="hprompt">Prompt</Label>
                <Textarea id="hprompt" rows={3} defaultValue="Start exploring the codebase" />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="interactive">Interactive session</Label>
                  <span className="text-xs text-muted-foreground">Spawn in a PTY and accept stdin, signals and resize from the console.</span>
                </div>
                <Switch id="interactive" checked={interactive} onCheckedChange={setInteractive} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="requires">Additional capabilities</Label>
            <Input
              id="requires"
              className="font-mono"
              value={extraRequires}
              onChange={(e) => setExtraRequires(e.target.value)}
              placeholder="git, gpu:rtx4090"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground">requires</span>
              {requires.map((r) => (
                <Capability key={r} name={r} matched />
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-2 text-xs text-muted-foreground">
              {eligible.length === 0
                ? "No registered node can claim this task — it will wait in the queue."
                : `${eligible.length} eligible node${eligible.length === 1 ? "" : "s"}`}
            </div>
            <ul className="flex flex-wrap gap-2">
              {nodes.map((n) => {
                const ok = eligible.includes(n)
                return (
                  <li
                    key={n.id}
                    className={
                      ok
                        ? "inline-flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 font-mono text-xs"
                        : "inline-flex items-center gap-1.5 rounded border border-dashed border-border px-2 py-1 font-mono text-xs text-muted-foreground/60 line-through"
                    }
                  >
                    <StatusDot status={n.status} />
                    {n.name}
                  </li>
                )
              })}
            </ul>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
            <DialogClose render={<Button type="submit" />}>Queue task</DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
