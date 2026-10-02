import { Button, Mono, PageHeader, Panel } from "@workplane/ui";
import { Play } from "lucide-react";
import type { Metadata } from "next";
import { RelativeTime } from "../../src/components/relative-time";
import { loadSkills } from "../../src/lib/data";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const { skills, runs } = await loadSkills();
  return (
    <>
      <PageHeader
        title="Skills"
        description="Reusable workplan definitions loaded from the skill registry. Attach one to a schedule to run it."
      />
      {skills.length === 0 && <Panel className="p-8 text-center text-sm text-muted-foreground">The control plane has no skills registered.</Panel>}
      <div className="grid gap-4 lg:grid-cols-3">
        {skills.map((skill) => {
          const lastRun = runs.find((run) => run.planId === skill.name);
          const inputs = Object.entries(skill.inputSchema.properties);
          const required = new Set(skill.inputSchema.required ?? []);
          return (
            <Panel key={skill.name} className="flex flex-col">
              <div className="flex flex-col gap-1.5 p-4">
                <h2 className="font-mono text-base font-medium">{skill.name}</h2>
                <p className="text-pretty text-sm text-muted-foreground">{skill.description}</p>
              </div>

              <dl className="flex flex-1 flex-col gap-2.5 border-t border-border p-4">
                {inputs.length === 0 && <p className="text-xs text-muted-foreground">Takes no inputs.</p>}
                {inputs.map(([name, input]) => (
                  <div key={name} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="flex items-baseline gap-1.5">
                      <span className="font-mono text-foreground">{name}</span>
                      {required.has(name) && <span className="text-destructive">*</span>}
                      <span className="font-mono text-muted-foreground">{input.type}</span>
                    </dt>
                    <dd className="truncate text-right font-mono text-muted-foreground" title={input.description}>
                      {input.default === undefined ? "—" : String(input.default)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {lastRun ? (
                    <>
                      Last run <RelativeTime iso={lastRun.createdAt} />
                    </>
                  ) : (
                    "Never run"
                  )}
                </span>
                <Button size="sm" variant="secondary" disabled title="Running a skill ad hoc needs a control-plane endpoint that does not exist yet">
                  <Play data-icon="inline-start" />
                  Run
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
