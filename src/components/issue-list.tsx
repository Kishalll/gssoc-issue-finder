import { EmptyState } from "@/components/empty-state";
import { IssueCard } from "@/components/issue-card";
import type { Issue } from "@/lib/types";

interface IssueListProps {
  issues: Issue[];
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
