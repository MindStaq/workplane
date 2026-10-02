import { expect, test, type Page } from "@playwright/test";

const waitForPatch = (page: Page) =>
  page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/api/workplane/schedules/"));

test.describe("read-only screens render the seeded control plane", () => {
  test("overview shows live runs, the queue, the fleet and upcoming schedules", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Control plane healthy")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live runs" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sleep 600/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fleet" })).toBeVisible();
    await expect(page.getByText("seed-gpu-box")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(page.getByText("Every five minutes").first()).toBeVisible();
  });

  test("tasks list every status and filters by status and kind", async ({ page }) => {
    await page.goto("/tasks");
    const table = page.getByRole("table", { name: "Tasks" });
    await expect(table).toBeVisible();
    for (const status of ["Succeeded", "Failed", "Running", "Queued", "Assigned", "Cancelled"]) {
      await expect(table.getByText(status, { exact: true }).first()).toBeVisible();
    }

    await page.getByRole("tab", { name: /^Failed/ }).click();
    await expect(table.getByText("exit 3")).toBeVisible();
    await expect(table.getByText("echo hello")).toHaveCount(0);

    await page.getByRole("tab", { name: /^All/ }).click();
    await page.getByRole("tab", { name: "Inference" }).click();
    await expect(table.getByText("Summarize")).toBeVisible();
    await expect(table.getByText("exit 3")).toHaveCount(0);
  });

  test("a finished run shows its logs and artifacts", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByRole("link", { name: /npm test/ }).click();
    await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
    await page.getByRole("table", { name: "Runs" }).getByRole("link").first().click();

    const log = page.getByRole("log");
    await expect(log.getByText("Tests: 42 passed")).toBeVisible();
    await expect(page.getByText("ended · ")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Artifacts" })).toBeVisible();
  });

  test("the failed task keeps its error and log lines", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByRole("link", { name: /exit 3/ }).click();
    await page.getByRole("table", { name: "Runs" }).getByRole("link").first().click();
    await expect(page.getByText("exit code 3").first()).toBeVisible();
    await page.getByRole("log").getByText("command failed with exit code 3").waitFor();
  });

  test("a running run is marked live", async ({ page }) => {
    await page.goto("/runs");
    await page.getByRole("table", { name: "Runs" }).getByRole("row", { name: /sleep 600/ }).getByRole("link").click();
    await expect(page.getByText(/streaming · /)).toBeVisible();
    await expect(page.getByRole("log").getByText("waiting...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel run" })).toBeVisible();
  });

  test("an interactive session accepts stdin and signals while it is live", async ({ page }) => {
    await page.goto("/runs");
    await page.getByRole("table", { name: "Runs" }).getByRole("row", { name: /Start exploring/ }).getByRole("link").click();
    await expect(page.getByRole("heading", { name: "Session" })).toBeVisible();
    await expect(page.getByRole("log").getByText("claude> exploring the repository")).toBeVisible();
    await expect(page.getByText(/\d+ input events? · PTY/)).toBeVisible();

    const before = await page.getByText(/\d+ input events? · PTY/).innerText();
    await page.getByLabel("Send stdin to the session").fill("hello agent");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/\d+ input events? · PTY/)).not.toHaveText(before);
    await expect(page.getByLabel("Send stdin to the session")).toHaveValue("");
  });

  test("nodes show capabilities and what they are doing", async ({ page }) => {
    await page.goto("/nodes");
    await expect(page.getByRole("heading", { name: "seed-laptop" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "seed-gpu-box" })).toBeVisible();
    await expect(page.getByText("ollama").first()).toBeVisible();
  });

  test("workplans list runs and the detail page shows recorded steps", async ({ page }) => {
    await page.goto("/workplans");
    const table = page.getByRole("table", { name: "Workplan runs" });
    await expect(table.getByText("Hello")).toBeVisible();
    await expect(table.getByText("Summarize file")).toBeVisible();

    await table.getByRole("link", { name: /Hello/ }).click();
    await expect(page.getByRole("heading", { name: "Hello" })).toBeVisible();
    await expect(page.getByText("hello from the seeded schedule").first()).toBeVisible();
    await expect(page.getByText("exit 0")).toBeVisible();
  });

  test("a failed workplan run shows the failing step and its error", async ({ page }) => {
    await page.goto("/workplans");
    await page.getByRole("link", { name: /Summarize file/ }).click();
    await expect(page.getByText("file not found").first()).toBeVisible();
    await expect(page.getByText("exit 1")).toBeVisible();
  });

  test("skills list their input schema; unsupported actions are disabled, not faked", async ({ page }) => {
    await page.goto("/skills");
    await expect(page.getByRole("heading", { name: "code-review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "summarize-file" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run" }).first()).toBeDisabled();
  });

  test("no screen logs console errors such as hydration mismatches", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`${page.url()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`${page.url()}: ${error.message}`));
    for (const path of ["/", "/tasks", "/runs", "/nodes", "/workplans", "/schedules", "/skills"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(problems).toEqual([]);
  });

  test("unknown ids show the not-found page", async ({ page }) => {
    await page.goto("/tasks/task_does_not_exist");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });
});

test.describe("actions go through the proxy to the control plane", () => {
  test("submitting a shell task queues it, then it can be cancelled", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Submit task" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Command").fill("echo from-e2e");
    await dialog.getByLabel("Additional capabilities").fill("gpu");
    await expect(dialog.getByText("No registered node can claim this task")).toBeVisible();
    await dialog.getByRole("button", { name: "Queue task" }).click();

    await expect(page).toHaveURL(/\/tasks\/task_/);
    await expect(page.getByRole("heading", { name: "echo from-e2e" })).toBeVisible();
    await expect(page.getByText("Queued", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
  });

  test("the dialog refuses an empty command", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Submit task" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Queue task" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Enter a command to run.");
  });

  test("a schedule can be paused, resumed and run now", async ({ page }) => {
    await page.goto("/schedules");
    const toggle = page.getByRole("switch", { name: /Nightly review/ });
    await expect(toggle).not.toBeChecked();
    await Promise.all([waitForPatch(page), toggle.click()]);
    await expect(page.getByRole("switch", { name: /Pause Nightly review/ })).toBeChecked();
    await page.reload();
    await expect(page.getByRole("switch", { name: /Pause Nightly review/ })).toBeChecked();
    await Promise.all([waitForPatch(page), page.getByRole("switch", { name: /Pause Nightly review/ }).click()]);
    await expect(page.getByRole("switch", { name: /Enable Nightly review/ })).not.toBeChecked();

    await page.getByRole("button", { name: "Run now" }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "Started" })).toBeVisible();
  });
});

test.describe("security", () => {
  test("the operator token never reaches the browser", async ({ page }) => {
    const seen: string[] = [];
    page.on("response", async (response) => {
      seen.push(await response.text().catch(() => ""));
      seen.push(JSON.stringify(await response.allHeaders()));
    });
    await page.goto("/tasks");
    await expect(page.getByRole("table", { name: "Tasks" })).toBeVisible();
    expect(seen.join("\n")).not.toContain("dev-operator-token");
    expect(await page.content()).not.toContain("dev-operator-token");
  });

  test("the proxy refuses node-only routes and still forwards operator routes", async ({ request }) => {
    const register = await request.post("/api/workplane/nodes/register", { data: { name: "x", capabilities: [] } });
    expect(register.status()).toBe(403);

    const nodes = await request.get("/api/workplane/nodes");
    expect(nodes.ok()).toBe(true);
    expect((await nodes.json()).nodes).toHaveLength(2);
  });
});
