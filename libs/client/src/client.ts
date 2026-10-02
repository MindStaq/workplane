import type {
  AppendInputEventInput,
  ArtifactListResponse,
  CreateTaskInput,
  CreateWorkplanScheduleInput,
  InputEventListResponse,
  NodeListResponse,
  OkResponse,
  PlanListResponse,
  RunListResponse,
  RunLogsResponse,
  RunRecord,
  RunStatus,
  ScheduleListResponse,
  SkillListResponse,
  TaskListResponse,
  TaskRecord,
  UpdateWorkplanScheduleInput,
  WorkplanRunListResponse,
  WorkplanRunRecord,
  WorkplanScheduleRecord,
  WorkplanStepListResponse,
  RunInputEvent,
} from "@workplane/types";

export interface WorkplaneClientOptions {
  /** Base URL of the control plane, for example `http://localhost:8787`. */
  baseUrl: string;
  /** Operator token. Sent as a bearer token on every request when set. */
  token?: string;
  /** Custom `fetch` (tests, server-side proxies). Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export interface ClientRequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/** Thrown for every non-2xx response. Message format and `Error` name match the pre-client CLI output. */
export class WorkplaneApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly path: string;
  readonly body: string;

  constructor(status: number, statusText: string, path: string, body: string) {
    super(`${status} ${statusText} from ${path}: ${body}`);
    this.status = status;
    this.statusText = statusText;
    this.path = path;
    this.body = body;
  }
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const segment = encodeURIComponent;

/**
 * Typed client for the Workplane control plane HTTP API. Uses only `fetch`, so it runs in Node,
 * the browser and edge runtimes. Browsers should talk to a server-side proxy rather than hold the
 * operator token themselves.
 */
export class WorkplaneClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WorkplaneClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Low-level escape hatch used by the typed methods below. */
  async request<T>(path: string, options: ClientRequestOptions = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (!response.ok) {
      throw new WorkplaneApiError(response.status, response.statusText, path, await response.text());
    }
    return (await response.json()) as T;
  }

  health(): Promise<OkResponse> {
    return this.request("/healthz");
  }

  listTasks(filters: { status?: RunStatus } = {}): Promise<TaskListResponse> {
    return this.request(`/tasks${query(filters)}`);
  }

  getTask(taskId: string): Promise<TaskRecord> {
    return this.request(`/tasks/${segment(taskId)}`);
  }

  createTask(input: CreateTaskInput): Promise<TaskRecord> {
    return this.request("/tasks", { method: "POST", body: input });
  }

  retryTask(taskId: string): Promise<TaskRecord> {
    return this.request(`/tasks/${segment(taskId)}/retry`, { method: "POST" });
  }

  cancelTask(taskId: string): Promise<TaskRecord> {
    return this.request(`/tasks/${segment(taskId)}/cancel`, { method: "POST" });
  }

  listRuns(filters: { taskId?: string; status?: RunStatus } = {}): Promise<RunListResponse> {
    return this.request(`/runs${query(filters)}`);
  }

  getRun(runId: string): Promise<RunRecord> {
    return this.request(`/runs/${segment(runId)}`);
  }

  /** Pass `afterId` (the highest log id already seen) to receive only newer rows. */
  getRunLogs(runId: string, options: { afterId?: number } = {}): Promise<RunLogsResponse> {
    return this.request(`/runs/${segment(runId)}/logs${query(options)}`);
  }

  listRunArtifacts(runId: string): Promise<ArtifactListResponse> {
    return this.request(`/runs/${segment(runId)}/artifacts`);
  }

  sendRunInput(runId: string, input: AppendInputEventInput): Promise<RunInputEvent> {
    return this.request(`/runs/${segment(runId)}/input`, { method: "POST", body: input });
  }

  listRunInputEvents(runId: string, options: { afterSequence?: number } = {}): Promise<InputEventListResponse> {
    return this.request(`/runs/${segment(runId)}/input${query(options)}`);
  }

  listNodes(): Promise<NodeListResponse> {
    return this.request("/nodes");
  }

  listSkills(): Promise<SkillListResponse> {
    return this.request("/skills");
  }

  listPlans(): Promise<PlanListResponse> {
    return this.request("/plans");
  }

  listSchedules(filters: { enabled?: boolean } = {}): Promise<ScheduleListResponse> {
    return this.request(`/schedules${query(filters)}`);
  }

  getSchedule(scheduleId: string): Promise<WorkplanScheduleRecord> {
    return this.request(`/schedules/${segment(scheduleId)}`);
  }

  createSchedule(input: CreateWorkplanScheduleInput): Promise<WorkplanScheduleRecord> {
    return this.request("/schedules", { method: "POST", body: input });
  }

  updateSchedule(scheduleId: string, input: UpdateWorkplanScheduleInput): Promise<WorkplanScheduleRecord> {
    return this.request(`/schedules/${segment(scheduleId)}`, { method: "PATCH", body: input });
  }

  deleteSchedule(scheduleId: string): Promise<OkResponse> {
    return this.request(`/schedules/${segment(scheduleId)}`, { method: "DELETE" });
  }

  runScheduleNow(scheduleId: string): Promise<WorkplanRunRecord> {
    return this.request(`/schedules/${segment(scheduleId)}/run`, { method: "POST" });
  }

  tickSchedules(): Promise<WorkplanRunListResponse> {
    return this.request("/schedules/tick", { method: "POST" });
  }

  listWorkplanRuns(filters: { scheduleId?: string } = {}): Promise<WorkplanRunListResponse> {
    return this.request(`/workplan-runs${query(filters)}`);
  }

  getWorkplanRun(runId: string): Promise<WorkplanRunRecord> {
    return this.request(`/workplan-runs/${segment(runId)}`);
  }

  listWorkplanSteps(runId: string): Promise<WorkplanStepListResponse> {
    return this.request(`/workplan-runs/${segment(runId)}/steps`);
  }
}
