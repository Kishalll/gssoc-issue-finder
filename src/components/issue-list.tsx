import { EmptyState } from "@/components/empty-state";
import { IssueCard } from "@/components/issue-card";
import type { Issue } from "@/lib/types";

interface IssueListProps {
  issues: Issue[];
  onBlacklistIssue: (issue: Issue) => void;
  onBlacklistRepo: (repoName: string) => void;
  blacklistedIssueIds: Set<string>;
  blacklistedRepos: Set<string>;
}

export function IssueList({
  issues,
  onBlacklistIssue,
  onBlacklistRepo,
  blacklistedIssueIds,
  blacklistedRepos
}: IssueListProps) {
  if (issues.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onBlacklistIssue={onBlacklistIssue}
          onBlacklistRepo={onBlacklistRepo}
          isIssueBlacklisted={blacklistedIssueIds.has(issue.id)}
          isRepoBlacklisted={blacklistedRepos.has(issue.repoName)}
        />
      ))}
    </div>
  );
}
