import { TaskList } from "../src/components/TaskList";

export default function DashboardPage() {
  return (
    <main>
      <h1>Workplane</h1>
      <p className="muted">
        Placeholder dashboard. It exists to prove the full path: browser, Next.js proxy, client, control plane, database.
      </p>
      <TaskList />
    </main>
  );
}
