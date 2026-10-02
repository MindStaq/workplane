import { Skeleton } from "@workplane/ui";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
