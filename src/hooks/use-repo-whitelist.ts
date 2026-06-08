"use client";

import * as React from "react";

import type { WhitelistState } from "@/lib/types";

const STORAGE_KEY = "gssoc-issue-finder-whitelist";

const initialState: WhitelistState = {
  enabled: false,
  repos: []
};

let cachedWhitelist: WhitelistState | null = null;
const listeners = new Set<() => void>();

function getWhitelist(): WhitelistState {
  if (cachedWhitelist) return cachedWhitelist;
  if (typeof window === "undefined") return initialState;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsedValue = JSON.parse(stored) as Partial<WhitelistState>;
      const parsed: WhitelistState = {
        enabled: typeof parsedValue.enabled === "boolean" ? parsedValue.enabled : false,
        repos: Array.isArray(parsedValue.repos)
          ? parsedValue.repos.filter((repo): repo is string => typeof repo === "string")
          : []
      };
      cachedWhitelist = parsed;
      return parsed;
    }
  } catch {}
  return initialState;
}

function setGlobalWhitelist(setter: (prev: WhitelistState) => WhitelistState) {
  const next = setter(getWhitelist());
  cachedWhitelist = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedWhitelist = null;
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useRepoWhitelist() {
  const whitelist = React.useSyncExternalStore(subscribe, getWhitelist, () => initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    setHasLoaded(true);
  }, []);

  const setEnabled = React.useCallback((enabled: boolean) => {
    setGlobalWhitelist((current) => ({ ...current, enabled }));
  }, []);

  const toggle = React.useCallback(() => {
    setGlobalWhitelist((current) => ({ ...current, enabled: !current.enabled }));
  }, []);

  const addRepo = React.useCallback((repoName: string) => {
    const normalized = repoName.trim();
    if (!normalized) {
      return;
    }

    setGlobalWhitelist((current) => {
      if (current.repos.includes(normalized)) {
        return current;
      }

      return {
        ...current,
        repos: [...current.repos, normalized].sort((left, right) => left.localeCompare(right))
      };
    });
  }, []);

  const removeRepo = React.useCallback((repoName: string) => {
    setGlobalWhitelist((current) => ({
      ...current,
      repos: current.repos.filter((repo) => repo !== repoName)
    }));
  }, []);

  const clearRepos = React.useCallback(() => {
    setGlobalWhitelist((current) => ({ ...current, repos: [] }));
  }, []);

  const isWhitelisted = React.useCallback(
    (repoName: string) => whitelist.repos.includes(repoName),
    [whitelist.repos]
  );

  return {
    whitelist,
    hasLoaded,
    setEnabled,
    toggle,
    addRepo,
    removeRepo,
    clearRepos,
    isWhitelisted
  };
}
