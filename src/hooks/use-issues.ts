"use client";

import * as React from "react";

import type { ApiResponse, FilterState, Issue } from "@/lib/types";

const initialFilters: FilterState = {
  level: "",
  type: ""
};

export function useIssues() {
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<FilterState>(initialFilters);
  const [searchQuery, setSearchQuery] = React.useState("");

  const fetchIssues = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.level) {
        params.set("level", filters.level);
      }

      if (filters.type) {
        params.set("type", filters.type);
      }

      const response = await fetch(`/api/issues${params.size ? `?${params.toString()}` : ""}`);
      const data = (await response.json()) as ApiResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch issues");
      }

      setIssues(data.issues);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch issues");
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    error,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    fetchIssues
  };
}
