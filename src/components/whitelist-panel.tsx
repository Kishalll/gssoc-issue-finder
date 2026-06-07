"use client";

import { ListChecks, Trash2, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { RepoTypeahead } from "@/components/repo-typeahead";
import type { OfficialProject, WhitelistState } from "@/lib/types";

interface WhitelistPanelProps {
  whitelist: WhitelistState;
  hasLoaded: boolean;
  allRepos: OfficialProject[];
  loadingProjects: boolean;
  projectsError: string | null;
  onToggle: () => void;
  onAddRepo: (repoName: string) => void;
  onRemoveRepo: (repoName: string) => void;
  onClearRepos: () => void;
  onRetry: () => void;
}

export function WhitelistPanel({
  whitelist,
  hasLoaded,
  allRepos,
  loadingProjects,
  projectsError,
  onToggle,
  onAddRepo,
  onRemoveRepo,
  onClearRepos,
  onRetry
}: WhitelistPanelProps) {
  const isOn = whitelist.enabled;

  return (
    <div className="rounded-lg border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <ListChecks className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Repo whitelist</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When ON, only issues from the repos you add here are scanned. Leave empty to fall back
              to all official repos.
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
          <span className="sr-only">{isOn ? "Disable whitelist" : "Enable whitelist"}</span>
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Add repos</label>
          {loadingProjects ? (
            <p className="text-sm text-muted-foreground">Loading official repo list...</p>
          ) : projectsError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <span>{projectsError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onRetry}
              >
                Retry
              </Button>
            </div>
          ) : allRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No official repos available right now.
            </p>
          ) : (
            <RepoTypeahead
              allRepos={allRepos}
              selectedRepos={whitelist.repos}
              onSelect={onAddRepo}
              disabled={!hasLoaded}
            />
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            Type to search across {allRepos.length} official repos. Prefix matches appear first.
          </p>
        </div>

        {whitelist.repos.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Whitelisted repos ({whitelist.repos.length})
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onClearRepos}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>
            <ul className="space-y-2">
              {whitelist.repos.map((repoName) => (
                <li
                  key={repoName}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <span className="truncate font-mono text-xs text-foreground">{repoName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => onRemoveRepo(repoName)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove {repoName} from whitelist</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No repos whitelisted yet. {isOn ? "Add one above to start filtering." : "Turn on the whitelist to use it."}
          </p>
        )}
      </div>
    </div>
  );
}
