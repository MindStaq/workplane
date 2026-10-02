import type { NodeRecord, RunRecord, TaskRecord } from "@workplane/types";
import { Capability, Mono, Panel, StatusBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workplane/ui";
import Link from "next/link";
import { taskSummary } from "../lib/derive";
import { Elapsed, RelativeTime } from "./relative-time";
import { KindLabel } from "./kind";

export interface TaskRow {
  task: TaskRecord;
  run: RunRecord | undefined;
  node: NodeRecord | undefined;
}

export function TasksTable({ rows, empty = "No tasks" }: { rows: TaskRow[]; empty?: string }) {
  return (
    <Panel>
      <Table aria-label="Tasks">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-32 pl-4">Status</TableHead>
            <TableHead>Task</TableHead>
            <TableHead className="hidden lg:table-cell">Requires</TableHead>
            <TableHead className="hidden md:table-cell">Node</TableHead>
            <TableHead className="pr-4 text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
          {rows.map(({ task, run, node }) => (
            <TableRow key={task.id} className="group relative">
              <TableCell className="pl-4">
                <StatusBadge status={task.status} />
              </TableCell>
              <TableCell className="max-w-0 w-full">
                <Link href={`/tasks/${task.id}`} className="flex flex-col gap-1 outline-none after:absolute after:inset-0">
                  <span className="flex items-center gap-3">
                    <KindLabel kind={task.kind} adapter={task.adapter} />
                    <Mono className="text-muted-foreground">{task.id}</Mono>
                  </span>
                  <span className="truncate font-mono text-xs text-foreground/80 group-hover:text-foreground">
                    {taskSummary(task)}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {task.requires.map((requirement) => (
                    <Capability key={requirement} name={requirement} />
                  ))}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {node ? <Mono>{node.name}</Mono> : <span className="text-xs text-muted-foreground">unclaimed</span>}
                {run && run.attempt > 1 && <span className="ml-1.5 text-xs text-muted-foreground">#{run.attempt}</span>}
              </TableCell>
              <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                <RelativeTime iso={task.updatedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}

export interface RunRow {
  run: RunRecord;
  task: TaskRecord | undefined;
  node: NodeRecord | undefined;
}

export function RunsTable({ rows, showTask = true, empty = "No runs yet" }: { rows: RunRow[]; showTask?: boolean; empty?: string }) {
  return (
    <Panel>
      <Table aria-label="Runs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-32 pl-4">Status</TableHead>
            <TableHead>Run</TableHead>
            {showTask && <TableHead className="hidden md:table-cell">Task</TableHead>}
            <TableHead>Node</TableHead>
            <TableHead className="hidden sm:table-cell">Duration</TableHead>
            <TableHead className="pr-4 text-right">Started</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={showTask ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
          {rows.map(({ run, task, node }) => (
            <TableRow key={run.id} className="group relative">
              <TableCell className="pl-4">
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell>
                <Link href={`/runs/${run.id}`} className="flex flex-col gap-0.5 outline-none after:absolute after:inset-0">
                  <Mono className="group-hover:text-primary">{run.id}</Mono>
                  <span className="text-xs text-muted-foreground">attempt {run.attempt}</span>
                </Link>
              </TableCell>
              {showTask && (
                <TableCell className="hidden max-w-0 md:table-cell md:w-full">
                  {task && <span className="block truncate font-mono text-xs text-muted-foreground">{taskSummary(task)}</span>}
                </TableCell>
              )}
              <TableCell>
                <Mono>{node?.name ?? run.nodeId}</Mono>
              </TableCell>
              <TableCell className="hidden font-mono text-xs tabular-nums sm:table-cell">
                <Elapsed start={run.startedAt} end={run.endedAt} />
              </TableCell>
              <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                <RelativeTime iso={run.startedAt} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
