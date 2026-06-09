"use client";

import * as React from "react";
import { X } from "lucide-react";


import { ConfigPage } from "@/components/config-page";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Header } from "@/components/header";
import { IssueList } from "@/components/issue-list";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PatAlert } from "@/components/pat-alert";
import { ProjectsListProvider } from "@/components/projects-list-provider";
import { SearchBar } from "@/components/search-bar";
import { Tabs, type TabId } from "@/components/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIssueBlacklist } from "@/hooks/use-issue-blacklist";
import { useIssues } from "@/hooks/use-issues";
import { useOwnerIssues } from "@/hooks/use-owner-issues";
import { useRepoWhitelist } from "@/hooks/use-repo-whitelist";
import { PAGE_SIZE } from "@/lib/constants";

export default function Home() {
  return (
    <ProjectsListProvider>
      <HomeContent />
    </ProjectsListProvider>
  );
}

function HomeContent() {
  const {
    issues,
    allIssues,
    loading,
    loadingStatus,
    loadingSeconds,
    progress,
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    fetchIssues,
    cancelFetch
  } = useIssues();
  const { blacklist, hasLoaded, toggle: toggleBlacklist, addRepo, removeRepo, addIssue, removeIssue } = useIssueBlacklist();
  const {
    whitelist: repoWhitelist,
    hasLoaded: whitelistLoaded,
    toggle: toggleWhitelist,
    addRepo: addWhitelistRepo,
    removeRepo: removeWhitelistRepo
  } = useRepoWhitelist();
  const ownerIssues = useOwnerIssues();
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [isStatusDismissed, setIsStatusDismissed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>("home");

  const blacklistedRepos = React.useMemo(() => new Set(blacklist.repos), [blacklist.repos]);
  const blacklistedIssueIds = React.useMemo(
    () => new Set(blacklist.issues.map((issue) => issue.id)),
    [blacklist.issues]
  );

  const { filteredIssues, filteredAllIssues, ownerFallback } = React.useMemo(() => {
    const nonBlacklistedIssues = issues.filter(
      (issue) =>
        !blacklist.enabled ||
        (!blacklistedRepos.has(issue.repoName) && !blacklistedIssueIds.has(issue.id))
    );
    const nonBlacklistedAllIssues = allIssues.filter(
      (issue) =>
        !blacklist.enabled ||
        (!blacklistedRepos.has(issue.repoName) && !blacklistedIssueIds.has(issue.id))
    );

    let finalIssues = nonBlacklistedIssues;
    let finalAllIssues = nonBlacklistedAllIssues;
    let fallback = false;

    if (ownerIssues.enabled) {
      const ownerOnly = nonBlacklistedIssues.filter((issue) => issue.isOwnerIssue);
      const ownerOnlyAll = nonBlacklistedAllIssues.filter((issue) => issue.isOwnerIssue);

      if (ownerOnly.length > 0) {
        finalIssues = ownerOnly;
        finalAllIssues = ownerOnlyAll;
      } else if (nonBlacklistedIssues.length > 0) {
        // Fallback: Owner Issues is ON, but no owner issues found. Show all non-blacklisted.
        fallback = true;
      }
    }

    return { filteredIssues: finalIssues, filteredAllIssues: finalAllIssues, ownerFallback: fallback };
  }, [issues, allIssues, blacklist.enabled, blacklistedIssueIds, blacklistedRepos, ownerIssues.enabled]);

  const visibleIssues = filteredIssues;
  const visibleAllIssues = filteredAllIssues;

  const paginatedIssues = visibleIssues.slice(0, visibleCount);
  const hiddenCount = allIssues.length - visibleAllIssues.length;
  const hasMore = visibleCount < visibleIssues.length;

  const handleSearch = async () => {
    setHasSearched(true);
    setVisibleCount(PAGE_SIZE);
    await fetchIssues(repoWhitelist);
  };

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);

  React.useEffect(() => {
    if (loadingStatus) {
      setIsStatusDismissed(false);
    }
  }, [loadingStatus]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <Header
        rightSlot={
          <Tabs
            active={activeTab}
            onChange={setActiveTab}
            items={[
              { id: "home", label: "Home" },
              { id: "config", label: "Config" }
            ]}
          />
        }
      />
      <main className="container flex-1 py-8">
        <PatAlert />
        {activeTab === "config" ? (
          <ConfigPage />
        ) : (
          <>
            <section className="mb-7 max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">
                GSSoC 2026 contributor tool
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance md:text-4xl">
                Find open GSSoC issues that need an owner.
              </h1>
            </section>

            <Card className="mb-8 shadow-soft">
              <CardContent className="space-y-5 p-5 md:p-6">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search issues by title, description, or repo name..."
                />
                <FilterBar
                  filters={filters}
                  onFilterChange={setFilters}
                  onSearch={handleSearch}
                  onCancel={cancelFetch}
                  isLoading={loading}
                />
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {whitelistLoaded ? (
                    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm transition-colors ${repoWhitelist.enabled ? 'border-primary/40 bg-primary/5' : 'border-dashed bg-muted/30'}`}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={repoWhitelist.enabled}
                          onClick={toggleWhitelist}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                            repoWhitelist.enabled ? "border-primary bg-primary" : "border-input bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
                              repoWhitelist.enabled ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                          <span className="sr-only">{repoWhitelist.enabled ? "Disable whitelist" : "Enable whitelist"}</span>
                        </button>
                        <span className={repoWhitelist.enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          Whitelist {repoWhitelist.enabled ? "Active" : "Inactive"}
                          {repoWhitelist.enabled && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground block sm:inline">
                              • {repoWhitelist.repos.length} repo{repoWhitelist.repos.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 bg-background px-3 text-xs"
                        onClick={() => setActiveTab("config")}
                      >
                        Manage
                      </Button>
                    </div>
                  ) : null}

                  {hasLoaded ? (
                    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm transition-colors ${blacklist.enabled ? 'border-primary/40 bg-primary/5' : 'border-dashed bg-muted/30'}`}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={blacklist.enabled}
                          onClick={toggleBlacklist}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                            blacklist.enabled ? "border-primary bg-primary" : "border-input bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
                              blacklist.enabled ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                          <span className="sr-only">{blacklist.enabled ? "Disable blacklist" : "Enable blacklist"}</span>
                        </button>
                        <span className={blacklist.enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          Blacklist {blacklist.enabled ? "Active" : "Inactive"}
                          {blacklist.enabled && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground block sm:inline">
                              • {blacklist.repos.length + blacklist.issues.length} item{blacklist.repos.length + blacklist.issues.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 bg-background px-3 text-xs"
                        onClick={() => setActiveTab("config")}
                      >
                        Manage
                      </Button>
                    </div>
                  ) : null}

                  {ownerIssues.hasLoaded ? (
                    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm transition-colors ${ownerIssues.enabled ? 'border-primary/40 bg-primary/5' : 'border-dashed bg-muted/30'}`}>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={ownerIssues.enabled}
                          onClick={ownerIssues.toggle}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                            ownerIssues.enabled ? "border-primary bg-primary" : "border-input bg-muted"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
                              ownerIssues.enabled ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                          <span className="sr-only">{ownerIssues.enabled ? "Disable Owner Issues" : "Enable Owner Issues"}</span>
                        </button>
                        <span className={ownerIssues.enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                          Owner Issues {ownerIssues.enabled ? "Only" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

              </CardContent>
            </Card>

            {error ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {ownerFallback ? (
              <div className="mb-4 flex items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
                <span>No owner&apos;s issues found, showing all issues.</span>
              </div>
            ) : null}

            {!error && loadingStatus && !loading && !isStatusDismissed ? (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground">
                <span>{loadingStatus}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setIsStatusDismissed(true)}
                  aria-label="Close status message"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Found {visibleIssues.length} unassigned issues with gssoc26 label
                {searchQuery ? ` (${visibleAllIssues.length} before local search)` : ""}
                {hiddenCount > 0 ? ` • ${hiddenCount} hidden by blacklist` : ""}
                {loading && progress.totalRepos > 0
                  ? ` • ${progress.loadedRepos} / ${progress.totalRepos} repos loaded`
                  : ""}
              </p>
              {hasSearched && allIssues.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Showing {Math.min(visibleCount, visibleIssues.length)} of {visibleIssues.length}
                </p>
              ) : null}
            </div>

            {loading ? (
              <>
                <LoadingSkeleton
                  status={loadingStatus}
                  elapsedSeconds={loadingSeconds}
                  loadedRepos={progress.loadedRepos}
                  totalRepos={progress.totalRepos}
                />
                {paginatedIssues.length > 0 ? (
                  <div className="mt-6">
                    <IssueList
                      issues={paginatedIssues}
                      onBlacklistIssue={addIssue}
                      onBlacklistRepo={addRepo}
                      blacklistedIssueIds={blacklistedIssueIds}
                      blacklistedRepos={blacklistedRepos}
                    />
                  </div>
                ) : null}
              </>
            ) : hasSearched ? (
              <>
                <IssueList
                  issues={paginatedIssues}
                  onBlacklistIssue={addIssue}
                  onBlacklistRepo={addRepo}
                  blacklistedIssueIds={blacklistedIssueIds}
                  blacklistedRepos={blacklistedRepos}
                />
                {hasMore ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    >
                      Load More
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState description="Click Search to fetch open, unassigned GSSoC issues" />
            )}
          </>
        )}
      </main>
    </div>
  );
}
