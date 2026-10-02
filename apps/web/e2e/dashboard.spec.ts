import { expect, test } from "@playwright/test";

test("dashboard lists seeded tasks through the proxy, client and control plane", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "Tasks" });
  await expect(table).toBeVisible();
  await expect(table.getByText("succeeded").first()).toBeVisible();
  await expect(table.getByText("failed")).toHaveCount(1);
  await expect(table.getByText("running")).toHaveCount(1);
  await expect(table.getByText("queued").first()).toBeVisible();
  await expect(table.getByText("cancelled")).toHaveCount(1);
});

test("the operator token never reaches the browser", async ({ page }) => {
  const seen: string[] = [];
  page.on("response", async (response) => {
    seen.push(await response.text().catch(() => ""));
    seen.push(JSON.stringify(await response.allHeaders()));
  });
  await page.goto("/");
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
