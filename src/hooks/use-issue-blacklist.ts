"use client";

import * as React from "react";

import type { BlacklistState, Issue } from "@/lib/types";

const STORAGE_KEY = "gssoc-issue-finder-blacklist";

const initialState: BlacklistState = {
  repos: [],
  issues: []
};

export function useIssueBlacklist() {
  const [blacklist, setBlacklist] = React.useState<BlacklistState>(initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        setHasLoaded(true);
        return;
      }

      const parsedValue = JSON.parse(storedValue) as Partial<BlacklistState>;
      setBlacklist({
        repos: Array.isArray(parsedValue.repos)
          ? parsedValue.repos.filter((repo): repo is string => typeof repo === "string")
          : [],
        issues: Array.isArray(parsedValue.issues)
          ? parsedValue.issues.filter(
              (issue): issue is BlacklistState["issues"][number] =>
                typeof issue?.id === "string" &&
                typeof issue?.title === "string" &&
                typeof issue?.repoName === "string"
            )
          : []
      });
    } catch {
      setBlacklist(initialState);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blacklist));
  }, [blacklist, hasLoaded]);

  const addRepo = React.useCallback((repoName: string) => {
    setBlacklist((current) => {
      if (current.repos.includes(repoName)) {
        return current;
      }

      return {
        ...current,
        repos: [...current.repos, repoName].sort((left, right) => left.localeCompare(right))
      };
    });
  }, []);

  const removeRepo = React.useCallback((repoName: string) => {
    setBlacklist((current) => ({
      ...current,
      repos: current.repos.filter((repo) => repo !== repoName)
    }));
  }, []);

  const addIssue = React.useCallback((issue: Issue) => {
    setBlacklist((current) => {
      if (current.issues.some((entry) => entry.id === issue.id)) {
        return current;
      }

      return {
        ...current,
        issues: [...current.issues, { id: issue.id, title: issue.title, repoName: issue.repoName }].sort(
          (left, right) => left.title.localeCompare(right.title)
        )
      };
    });
  }, []);

  const removeIssue = React.useCallback((issueId: string) => {
    setBlacklist((current) => ({
      ...current,
      issues: current.issues.filter((issue) => issue.id !== issueId)
    }));
  }, []);

  return {
    blacklist,
    hasLoaded,
    addRepo,
    removeRepo,
    addIssue,
    removeIssue
  };
}
