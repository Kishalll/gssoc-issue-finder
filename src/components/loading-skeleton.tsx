import { Skeleton } from "@/components/ui/skeleton";

interface LoadingSkeletonProps {
  status?: string;
  elapsedSeconds?: number;
  loadedRepos?: number;
  totalRepos?: number;
}

export function LoadingSkeleton({
  status,
  elapsedSeconds = 0,
  loadedRepos = 0,
  totalRepos = 0
}: LoadingSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card px-5 py-4">
        <p className="text-sm font-medium text-foreground">
          {status || "Loading issues. Please wait."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Current status: {loadedRepos > 0 || totalRepos > 0 ? `${loadedRepos} / ${totalRepos} repos loaded` : "starting"}
          {elapsedSeconds > 0 ? ` • ${elapsedSeconds}s elapsed` : ""}
        </p>
      </div>

      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-4/5 max-w-[720px]" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="mt-4 h-4 w-64 max-w-full" />
        </div>
      ))}
    </div>
  );
}
