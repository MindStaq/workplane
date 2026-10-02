"use client";

import { Button, Panel } from "@workplane/ui";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Panel className="flex flex-col items-start gap-3 p-6">
      <h1 className="text-lg font-semibold">Cannot reach the control plane</h1>
      <p role="alert" className="text-sm text-muted-foreground">
        The page could not load its data. Check that workplane-server is running and that WORKPLANE_SERVER_URL (and
        WORKPLANE_OPERATOR_TOKEN, if reads are protected) are correct for this web app.
      </p>
      <Button size="sm" onClick={reset}>
        Try again
      </Button>
    </Panel>
  );
}
