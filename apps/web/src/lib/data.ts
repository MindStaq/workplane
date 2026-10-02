import type { NodeRecord, RunLogRecord } from "@workplane/types";
import { controlPlane, orNotFound, orUndefined } from "./control-plane";
import { byId, isActiveTask, latestRunByTask, newestFirst } from "./derive";

/** Everything the sidebar and top bar need on every page. It never throws: an unreachable control plane is a state, not an error. */
export interface ShellData {
  healthy: boolean;
  serverHost: string;
  nodes: NodeRecord[];
  activeTasks: number;
  /** Whether this server has an operator token configured. The token itself never leaves the server. */
  operatorToken: boolean;
}

export async function loadShell(): Promise<ShellData> {
  const client = controlPlane();
  const serverHost = (process.env.WORKPLANE_SERVER_URL ?? "http://localhost:8787").replace(/^https?:\/\//, "");
  const operatorToken = Boolean(process.env.WORKPLANE_OPERATOR_TOKEN);
  try {
    const [, { nodes }, { tasks }] = await Promise.all([client.health(), client.listNodes(), client.listTasks()]);
    return { healthy: true, serverHost, operatorToken, nodes, activeTasks: tasks.filter((task) => isActiveTask(task.status)).length };
  } catch {
    return { healthy: false, serverHost, operatorToken, nodes: [], activeTasks: 0 };
  }
}

export async function loadOverview() {
  const client = controlPlane();
  const [{ tasks }, { runs }, { nodes }, { schedules }, { runs: workplanRuns }] = await Promise.all([
    client.listTasks(),
    client.listRuns(),
    client.listNodes(),
    client.listSchedules(),
    client.listWorkplanRuns(),
  ]);
  const live = runs.filter((run) => run.status === "running");
  const tails = new Map<string, RunLogRecord[]>(
    await Promise.all(
      live.map(async (run): Promise<[string, RunLogRecord[]]> => [run.id, (await client.getRunLogs(run.id)).logs.slice(-3)]),
    ),
  );
  return { tasks, runs, nodes, schedules, workplanRuns: newestFirst(workplanRuns, (w) => w.createdAt), tails };
}

export async function loadTasks() {
  const client = controlPlane();
  const [{ tasks }, { runs }, { nodes }] = await Promise.all([client.listTasks(), client.listRuns(), client.listNodes()]);
  return { tasks: newestFirst(tasks, (task) => task.updatedAt), latest: latestRunByTask(runs), nodes: byId(nodes) };
}

export async function loadRuns() {
  const client = controlPlane();
  const [{ runs }, { tasks }, { nodes }] = await Promise.all([client.listRuns(), client.listTasks(), client.listNodes()]);
  return { runs: newestFirst(runs, (run) => run.startedAt), tasks: byId(tasks), nodes: byId(nodes) };
}

export async function loadTask(taskId: string) {
  const client = controlPlane();
  const task = await orNotFound(client.getTask(taskId));
  const [{ runs }, { nodes }] = await Promise.all([client.listRuns({ taskId }), client.listNodes()]);
  return { task, runs: [...runs].sort((a, b) => b.attempt - a.attempt), nodes };
}

export async function loadRun(runId: string) {
  const client = controlPlane();
  const run = await orNotFound(client.getRun(runId));
  const [task, { logs }, { artifacts }, { events }, { runs: siblings }, { nodes }] = await Promise.all([
    client.getTask(run.taskId),
    client.getRunLogs(runId),
    client.listRunArtifacts(runId),
    client.listRunInputEvents(runId),
    client.listRuns({ taskId: run.taskId }),
    client.listNodes(),
  ]);
  return {
    run,
    task,
    logs,
    artifacts,
    eventCount: events.length,
    siblings: [...siblings].sort((a, b) => a.attempt - b.attempt),
    node: nodes.find((candidate) => candidate.id === run.nodeId),
    nodes: byId(nodes),
  };
}

export async function loadNodes() {
  const client = controlPlane();
  const [{ nodes }, { runs }, { tasks }] = await Promise.all([client.listNodes(), client.listRuns(), client.listTasks()]);
  return { nodes, runs, tasks: byId(tasks) };
}

/** Recorded step counts for the most recent workplan runs; the list endpoint does not include them. */
const STEP_SUMMARY_LIMIT = 25;

export async function loadWorkplanRuns() {
  const client = controlPlane();
  const [{ runs }, { schedules }] = await Promise.all([client.listWorkplanRuns(), client.listSchedules()]);
  const sorted = newestFirst(runs, (run) => run.createdAt);
  const steps = new Map(
    await Promise.all(
      sorted.slice(0, STEP_SUMMARY_LIMIT).map(async (run) => [run.id, (await client.listWorkplanSteps(run.id)).steps] as const),
    ),
  );
  return { runs: sorted, steps, schedules: byId(schedules) };
}

export async function loadWorkplanRun(workplanRunId: string) {
  const client = controlPlane();
  const run = await orNotFound(client.getWorkplanRun(workplanRunId));
  const [{ steps }, { skills }, schedule] = await Promise.all([
    client.listWorkplanSteps(workplanRunId),
    client.listSkills(),
    run.scheduleId ? orUndefined(client.getSchedule(run.scheduleId)) : Promise.resolve(undefined),
  ]);
  return { run, steps, skill: skills.find((skill) => skill.name === run.planId), schedule };
}

export async function loadSchedules() {
  const { schedules } = await controlPlane().listSchedules();
  return schedules;
}

export async function loadSkills() {
  const client = controlPlane();
  const [{ skills }, { runs }] = await Promise.all([client.listSkills(), client.listWorkplanRuns()]);
  return { skills, runs: newestFirst(runs, (run) => run.createdAt) };
}
