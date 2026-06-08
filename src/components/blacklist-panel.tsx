"use client";

import { Ban, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BlacklistState } from "@/lib/types";

interface BlacklistPanelProps {
  blacklist: BlacklistState;
  onToggle: () => void;
  onRemoveRepo: (repoName: string) => void;
  onRemoveIssue: (issueId: string) => void;
}

export function BlacklistPanel({
  blacklist,
  onToggle,
  onRemoveRepo,
  onRemoveIssue
}: BlacklistPanelProps) {
  const hasEntries = blacklist.repos.length > 0 || blacklist.issues.length > 0;

  const isOn = blacklist.enabled;

  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-background p-2 text-muted-foreground">
            <Ban className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Blacklist</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When ON, hidden repos and issues stay out of search results on this browser.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
            isOn ? "border-primary bg-primary" : "border-input bg-muted"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
              isOn ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
          <span className="sr-only">{isOn ? "Disable blacklist" : "Enable blacklist"}</span>
        </button>
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
