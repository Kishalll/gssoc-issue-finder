"use client";

import * as React from "react";

import type { BlacklistState, Issue } from "@/lib/types";

const STORAGE_KEY = "gssoc-issue-finder-blacklist";

const initialState: BlacklistState = {
  repos: [],
  issues: []
};

let cachedBlacklist: BlacklistState | null = null;
const listeners = new Set<() => void>();

function getBlacklist(): BlacklistState {
  if (cachedBlacklist) return cachedBlacklist;
  if (typeof window === "undefined") return initialState;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedValue = JSON.parse(stored) as Partial<BlacklistState>;
      const parsed: BlacklistState = {
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
      };
      cachedBlacklist = parsed;
      return parsed;
    }
  } catch {}
  return initialState;
}

function setGlobalBlacklist(setter: (prev: BlacklistState) => BlacklistState) {
  const next = setter(getBlacklist());
  cachedBlacklist = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedBlacklist = null;
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useIssueBlacklist() {
  const blacklist = React.useSyncExternalStore(subscribe, getBlacklist, () => initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    setHasLoaded(true);
  }, []);

  const addRepo = React.useCallback((repoName: string) => {
    setGlobalBlacklist((current) => {
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
    setGlobalBlacklist((current) => ({
      ...current,
      repos: current.repos.filter((repo) => repo !== repoName)
    }));
  }, []);

  const addIssue = React.useCallback((issue: Issue) => {
    setGlobalBlacklist((current) => {
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
    setGlobalBlacklist((current) => ({
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
