import { Ban, ExternalLink, FolderCheck, FolderX, GitCommitHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Issue } from "@/lib/types";
import { formatRelativeTime, getContrastTextColor } from "@/lib/utils";

interface IssueCardProps {
  issue: Issue;
  onBlacklistIssue: (issue: Issue) => void;
  onBlacklistRepo: (repoName: string) => void;
  isRepoBlacklisted: boolean;
  isIssueBlacklisted: boolean;
}

export function IssueCard({
  issue,
  onBlacklistIssue,
  onBlacklistRepo,
  isRepoBlacklisted,
  isIssueBlacklisted
}: IssueCardProps) {
  return (
    <article className="rounded-lg border bg-card p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-soft">
      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex max-w-full items-start gap-2 text-base font-semibold leading-6 tracking-tight text-card-foreground underline-offset-4 hover:underline"
      >
        <span>{issue.title}</span>
        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </a>

      <div className="mt-3">
        <Badge variant="secondary" className="gap-1.5">
          <GitCommitHorizontal className="h-3.5 w-3.5" />
          Last commit {issue.lastCommitAt ? formatRelativeTime(issue.lastCommitAt) : "unknown"}
        </Badge>
      </div>

      {issue.labels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {issue.labels.map((label) => {
            const labelColor = `#${label.color.replace("#", "")}`;
            const textColor = getContrastTextColor(label.color);
            const isDarkLabel = textColor === "#f9fafb";

            return (
              <Badge
                key={`${issue.id}-${label.name}`}
                variant="outline"
                style={{
                  borderColor: labelColor,
                  color: textColor,
                  backgroundColor: isDarkLabel ? labelColor : `${labelColor}24`
                }}
              >
                {label.name}
              </Badge>
            );
          })}
        </div>
      ) : null}

      <p className="mt-3 text-sm text-muted-foreground">
        {issue.repoName} <span aria-hidden="true">•</span> {issue.comments} comments{" "}
        <span aria-hidden="true">•</span> {formatRelativeTime(issue.createdAt)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {issue.gssocProjectUrl ? (
          <Button type="button" variant="default" size="sm" className="gap-2" asChild>
            <a href={issue.gssocProjectUrl} target="_blank" rel="noopener noreferrer">
              <FolderCheck className="h-4 w-4" />
              Verify repo
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onBlacklistIssue(issue)}
          disabled={isRepoBlacklisted || isIssueBlacklisted}
        >
          <Ban className="h-4 w-4" />
          {isIssueBlacklisted ? "Issue blacklisted" : "Blacklist issue"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onBlacklistRepo(issue.repoName)}
          disabled={isRepoBlacklisted}
        >
          <FolderX className="h-4 w-4" />
          {isRepoBlacklisted ? "Repo blacklisted" : "Blacklist repo"}
        </Button>
      </div>
    </article>
  );
}
