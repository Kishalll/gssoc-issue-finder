"use client";

import * as React from "react";

import type { ApiResponse, FilterState, Issue, IssueProgressState, IssueStreamEvent } from "@/lib/types";

const initialFilters: FilterState = {
  level: "",
  type: ""
};

export function useIssues() {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingStatus, setLoadingStatus] = React.useState("");
  const [loadingSeconds, setLoadingSeconds] = React.useState(0);
  const [progress, setProgress] = React.useState<IssueProgressState>({
    loadedRepos: 0,
    totalRepos: 0,
    searchableRepos: 0
  });
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<FilterState>(initialFilters);
  const [searchQuery, setSearchQuery] = React.useState("");
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!loading) {
      setLoadingSeconds(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [loading]);

  const fetchIssues = React.useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setLoadingSeconds(0);
    setLoadingStatus("Loading official GSSoC repos and matching issues. Please wait.");
    setProgress({ loadedRepos: 0, totalRepos: 0, searchableRepos: 0 });
    setError(null);
    setIssues([]);

    try {
      const params = new URLSearchParams();

      if (filters.level) {
        params.set("level", filters.level);
      }

      if (filters.type) {
        params.set("type", filters.type);
      }

      params.set("stream", "1");
      const response = await fetch(`/api/issues?${params.toString()}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        const data = (await response.json()) as ApiResponse & { error?: string };
        throw new Error(data.error ?? "Failed to fetch issues");
      }

      if (!response.body) {
        throw new Error("Issue stream is unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as IssueStreamEvent;

          if (event.type === "status" || event.type === "fallback") {
            setLoadingStatus(event.message);
            continue;
          }

          if (event.type === "progress") {
            setLoadingStatus(event.message);
            setProgress({
              loadedRepos: event.loadedRepos,
              totalRepos: event.totalRepos,
              searchableRepos: event.searchableRepos
            });
            setIssues(event.issues);
            continue;
          }

          if (event.type === "complete") {
            setLoadingStatus(event.message);
            setProgress({
              loadedRepos: event.loadedRepos,
              totalRepos: event.totalRepos,
              searchableRepos: event.searchableRepos
            });
            setIssues(event.issues);
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (fetchError) {
      if (controller.signal.aborted) {
        setLoadingStatus("Search canceled. Showing partial results.");
        return;
      }

      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch issues");
      setIssues([]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoading(false);
    }
  }, [filters]);

  const cancelFetch = React.useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const filteredIssues = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return issues;
    }

    return issues.filter(
      (issue) =>
        issue.title.toLowerCase().includes(query) ||
        (issue.body?.toLowerCase().includes(query) ?? false) ||
        issue.repoName.toLowerCase().includes(query)
    );
  }, [issues, searchQuery]);

  return {
    issues: filteredIssues,
    allIssues: issues,
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
  };
}
