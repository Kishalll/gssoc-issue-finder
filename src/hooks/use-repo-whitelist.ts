"use client";

import * as React from "react";

import type { WhitelistState } from "@/lib/types";

const STORAGE_KEY = "gssoc-issue-finder-whitelist";

const initialState: WhitelistState = {
  enabled: false,
  repos: []
};

export function useRepoWhitelist() {
  const [whitelist, setWhitelist] = React.useState<WhitelistState>(initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);

      if (!storedValue) {
        setHasLoaded(true);
        return;
      }

      const parsedValue = JSON.parse(storedValue) as Partial<WhitelistState>;
      setWhitelist({
        enabled: typeof parsedValue.enabled === "boolean" ? parsedValue.enabled : false,
        repos: Array.isArray(parsedValue.repos)
          ? parsedValue.repos.filter((repo): repo is string => typeof repo === "string")
          : []
      });
    } catch {
      setWhitelist(initialState);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(whitelist));
  }, [whitelist, hasLoaded]);

  const setEnabled = React.useCallback((enabled: boolean) => {
    setWhitelist((current) => ({ ...current, enabled }));
  }, []);

  const toggle = React.useCallback(() => {
    setWhitelist((current) => ({ ...current, enabled: !current.enabled }));
  }, []);

  const addRepo = React.useCallback((repoName: string) => {
    const normalized = repoName.trim();

    if (!normalized) {
      return;
    }

    setWhitelist((current) => {
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
    setWhitelist((current) => ({
      ...current,
      repos: current.repos.filter((repo) => repo !== repoName)
    }));
  }, []);

  const clearRepos = React.useCallback(() => {
    setWhitelist((current) => ({ ...current, repos: [] }));
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
