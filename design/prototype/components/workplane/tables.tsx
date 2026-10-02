import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getLatestRun, getNode, getTask } from "@/lib/mock-data"
import { duration, relativeTime, taskSummary } from "@/lib/format"
import type { RunRecord, TaskRecord } from "@/lib/types"
import { Capability, KindLabel, Mono, Panel } from "./primitives"
import { StatusBadge } from "./status-badge"

export function TasksTable({ tasks, empty = "No tasks" }: { tasks: TaskRecord[]; empty?: string }) {
  return (
    <Panel>
      <Table>
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
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
          {tasks.map((task) => {
            const run = getLatestRun(task.id)
            const node = run ? getNode(run.nodeId) : undefined
            return (
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
                    {task.requires.map((r) => (
                      <Capability key={r} name={r} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {node ? <Mono>{node.name}</Mono> : <span className="text-xs text-muted-foreground">unclaimed</span>}
                  {run && run.attempt > 1 && <span className="ml-1.5 text-xs text-muted-foreground">#{run.attempt}</span>}
                </TableCell>
                <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                  {relativeTime(task.updatedAt)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Panel>
  )
}

export function RunsTable({ runs, showTask = true }: { runs: RunRecord[]; showTask?: boolean }) {
  return (
    <Panel>
      <Table>
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
          {runs.map((run) => {
            const task = getTask(run.taskId)
            const node = getNode(run.nodeId)
            return (
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
                  {duration(run.startedAt, run.endedAt)}
                </TableCell>
                <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
                  {relativeTime(run.startedAt)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Panel>
  )
}
