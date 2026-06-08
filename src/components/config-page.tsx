"use client";

import { BlacklistPanel } from "@/components/blacklist-panel";
import { useProjectsList } from "@/components/projects-list-provider";
import { WhitelistPanel } from "@/components/whitelist-panel";
import { useIssueBlacklist } from "@/hooks/use-issue-blacklist";
import { useRepoWhitelist } from "@/hooks/use-repo-whitelist";
import type { BlacklistState } from "@/lib/types";

export function ConfigPage() {
  const {
    whitelist,
    hasLoaded: whitelistLoaded,
    toggle: toggleWhitelist,
    addRepo: addWhitelistRepo,
    removeRepo: removeWhitelistRepo,
    clearRepos: clearWhitelistRepos
  } = useRepoWhitelist();

  const {
    blacklist,
    hasLoaded: blacklistLoaded,
    toggle: toggleBlacklist,
    addRepo: addBlacklistRepo,
    removeRepo: removeBlacklistRepo,
    addIssue: addBlacklistIssue,
    removeIssue: removeBlacklistIssue
  } = useIssueBlacklist();

  const { projects, loading: loadingProjects, error: projectsError, retry: retryProjects } =
    useProjectsList();

  return (
    <div className="space-y-6">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">Config</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance md:text-4xl">
          Tweak the issue finder for your workflow.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Curate which repos to scan and hide the ones you want to ignore. Settings are saved in
          this browser only.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <WhitelistPanel
          whitelist={whitelist}
          hasLoaded={whitelistLoaded}
          allRepos={projects}
          loadingProjects={loadingProjects}
          projectsError={projectsError}
          onToggle={toggleWhitelist}
          onAddRepo={addWhitelistRepo}
          onRemoveRepo={removeWhitelistRepo}
          onClearRepos={clearWhitelistRepos}
          onRetry={retryProjects}
        />
        {blacklistLoaded ? (
          <BlacklistPanel
            blacklist={blacklist as BlacklistState}
            onToggle={toggleBlacklist}
            onRemoveRepo={removeBlacklistRepo}
            onRemoveIssue={removeBlacklistIssue}
          />
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Loading blacklist...
          </div>
        )}
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Tip: blacklist entries are added from issue cards on the home tab. Use the whitelist above
        to scope which repos get scanned.
      </div>
    </div>
  );
}
