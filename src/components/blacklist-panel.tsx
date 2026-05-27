"use client";

import { Ban, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BlacklistState } from "@/lib/types";

interface BlacklistPanelProps {
  blacklist: BlacklistState;
  onRemoveRepo: (repoName: string) => void;
  onRemoveIssue: (issueId: string) => void;
}

export function BlacklistPanel({
  blacklist,
  onRemoveRepo,
  onRemoveIssue
}: BlacklistPanelProps) {
  const hasEntries = blacklist.repos.length > 0 || blacklist.issues.length > 0;

  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-background p-2 text-muted-foreground">
          <Ban className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Blacklist</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hidden repos and issues stay out of search results on this browser.
          </p>
        </div>
      </div>

      {hasEntries ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Repos
            </p>
            <div className="space-y-2">
              {blacklist.repos.map((repoName) => (
                <div
                  key={repoName}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <span className="truncate text-sm text-foreground">{repoName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onRemoveRepo(repoName)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove {repoName} from blacklist</span>
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Issues
            </p>
            <div className="space-y-2">
              {blacklist.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{issue.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{issue.repoName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onRemoveIssue(issue.id)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove {issue.title} from blacklist</span>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No blacklisted repos or issues yet.</p>
      )}
    </div>
  );
}
