"use client";

import * as React from "react";
import { X } from "lucide-react";

import { BlacklistPanel } from "@/components/blacklist-panel";
import { ConfigPage } from "@/components/config-page";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { Header } from "@/components/header";
import { IssueList } from "@/components/issue-list";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ProjectsListProvider } from "@/components/projects-list-provider";
import { SearchBar } from "@/components/search-bar";
import { Tabs, type TabId } from "@/components/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useIssueBlacklist } from "@/hooks/use-issue-blacklist";
import { useIssues } from "@/hooks/use-issues";
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
  const { blacklist, hasLoaded, addRepo, removeRepo, addIssue, removeIssue } = useIssueBlacklist();
  const {
    whitelist: repoWhitelist,
    hasLoaded: whitelistLoaded,
    addRepo: addWhitelistRepo,
    removeRepo: removeWhitelistRepo
  } = useRepoWhitelist();
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [isStatusDismissed, setIsStatusDismissed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>("home");

  const blacklistedRepos = React.useMemo(() => new Set(blacklist.repos), [blacklist.repos]);
  const blacklistedIssueIds = React.useMemo(
    () => new Set(blacklist.issues.map((issue) => issue.id)),
    [blacklist.issues]
  );

  const visibleIssues = React.useMemo(
    () =>
      issues.filter(
        (issue) => !blacklistedRepos.has(issue.repoName) && !blacklistedIssueIds.has(issue.id)
      ),
    [issues, blacklistedIssueIds, blacklistedRepos]
  );

  const visibleAllIssues = React.useMemo(
    () =>
      allIssues.filter(
        (issue) => !blacklistedRepos.has(issue.repoName) && !blacklistedIssueIds.has(issue.id)
      ),
    [allIssues, blacklistedIssueIds, blacklistedRepos]
  );

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
      <main className="container py-8 md:py-10">
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
                {whitelistLoaded && repoWhitelist.enabled ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span>
                      Whitelist ON: {repoWhitelist.repos.length} repo
                      {repoWhitelist.repos.length === 1 ? "" : "s"} selected
                      {repoWhitelist.repos.length === 0 ? " (empty - showing all repos)" : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setActiveTab("config")}
                    >
                      Manage
                    </Button>
                  </div>
                ) : null}
                {hasLoaded ? (
                  <BlacklistPanel
                    blacklist={blacklist}
                    onRemoveRepo={removeRepo}
                    onRemoveIssue={removeIssue}
                  />
                ) : null}
              </CardContent>
            </Card>

            {error ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
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
