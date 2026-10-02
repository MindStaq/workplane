"use client";

import type { NodeRecord } from "@workplane/types";
import {
  Button,
  Capability,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  StatusDot,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@workplane/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient, errorMessage } from "../lib/browser-client";
import { eligibleNodes } from "../lib/derive";
import { buildTaskInput, HARNESSES, requiredCapabilities, type SubmitForm, type SubmitKind } from "../lib/submit";

const INITIAL: SubmitForm = {
  kind: "shell",
  command: "",
  model: "llama3.2",
  prompt: "",
  harness: "claude-code",
  repo: "",
  harnessPrompt: "",
  interactive: true,
  extraRequires: "",
};

export function SubmitTaskDialog({ nodes, triggerLabel = "Submit task" }: { nodes: NodeRecord[]; triggerLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SubmitForm>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<SubmitForm>) => setForm((current) => ({ ...current, ...patch }));
  const requires = requiredCapabilities(form);
  const eligible = eligibleNodes(nodes, requires);

  async function submit() {
    const built = buildTaskInput(form);
    if ("error" in built) {
      setError(built.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await browserClient().createTask(built.input);
      setOpen(false);
      setForm(INITIAL);
      router.push(`/tasks/${task.id}`);
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
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
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Tabs
            value={form.kind}
            onValueChange={(value) => update({ kind: value as SubmitKind, extraRequires: value === "harness" ? "git" : "" })}
          >
            <TabsList className="w-full">
              <TabsTrigger value="shell">Shell</TabsTrigger>
              <TabsTrigger value="inference">Inference</TabsTrigger>
              <TabsTrigger value="harness">Harness</TabsTrigger>
            </TabsList>
          </Tabs>

          {form.kind === "shell" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cmd">Command</Label>
              <Input id="cmd" className="font-mono" placeholder="pnpm test" value={form.command} onChange={(event) => update({ command: event.target.value })} />
            </div>
          )}

          {form.kind === "inference" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" className="font-mono" value={form.model} onChange={(event) => update({ model: event.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea id="prompt" rows={3} placeholder="Explain this stack trace…" value={form.prompt} onChange={(event) => update({ prompt: event.target.value })} />
              </div>
            </>
          )}

          {form.kind === "harness" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Harness</span>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Harness">
                  {HARNESSES.map((harness) => (
                    <button
                      key={harness}
                      type="button"
                      role="radio"
                      aria-checked={form.harness === harness}
                      onClick={() => update({ harness })}
                      className="rounded-md border border-border px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-muted aria-checked:border-primary/60 aria-checked:bg-primary/10 aria-checked:text-primary"
                    >
                      {harness}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="repo">Repository</Label>
                <Input id="repo" className="font-mono" placeholder="git@github.com:org/repo.git" value={form.repo} onChange={(event) => update({ repo: event.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="hprompt">Prompt</Label>
                <Textarea id="hprompt" rows={3} placeholder="Start exploring the codebase" value={form.harnessPrompt} onChange={(event) => update({ harnessPrompt: event.target.value })} />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="interactive">Interactive session</Label>
                  <span className="text-xs text-muted-foreground">Spawn in a PTY and accept stdin, signals and resize from the console.</span>
                </div>
                <Switch id="interactive" checked={form.interactive} onCheckedChange={(interactive) => update({ interactive })} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="requires">Additional capabilities</Label>
            <Input
              id="requires"
              className="font-mono"
              value={form.extraRequires}
              onChange={(event) => update({ extraRequires: event.target.value })}
              placeholder="git, gpu:rtx4090"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground">requires</span>
              {requires.map((requirement) => (
                <Capability key={requirement} name={requirement} matched />
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
              {nodes.map((node) => {
                const ok = eligible.includes(node);
                return (
                  <li
                    key={node.id}
                    className={
                      ok
                        ? "inline-flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 font-mono text-xs"
                        : "inline-flex items-center gap-1.5 rounded border border-dashed border-border px-2 py-1 font-mono text-xs text-muted-foreground/60 line-through"
                    }
                  >
                    <StatusDot status={node.status} />
                    {node.name}
                  </li>
                );
              })}
            </ul>
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Queuing…" : "Queue task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
