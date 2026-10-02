import type { Metadata } from "next"
import { PageHeader } from "@/components/workplane/primitives"
import { RunsTable } from "@/components/workplane/tables"
import { runs } from "@/lib/mock-data"

export const metadata: Metadata = { title: "Runs" }

export default function RunsPage() {
  const sorted = [...runs].sort((a, b) => (b.startedAt ?? "9").localeCompare(a.startedAt ?? "9"))
  return (
    <>
      <PageHeader
        title="Runs"
        description="Every execution attempt across the fleet, with its node, duration and outcome."
      />
      <RunsTable runs={sorted} />
    </>
  )
}
