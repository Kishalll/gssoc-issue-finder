import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Issue } from "@/lib/types";
import { formatRelativeTime, getContrastTextColor } from "@/lib/utils";

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
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
    </article>
  );
}
