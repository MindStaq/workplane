import { Panel } from "@workplane/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <Panel className="flex flex-col items-start gap-2 p-6">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">The control plane has no record with that id.</p>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Back to the overview
      </Link>
    </Panel>
  );
}
