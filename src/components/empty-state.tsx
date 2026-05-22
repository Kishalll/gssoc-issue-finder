import { SearchX } from "lucide-react";

interface EmptyStateProps {
  description?: string;
}

export function EmptyState({ description = "Try adjusting your filters" }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <SearchX className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">No issues found</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
