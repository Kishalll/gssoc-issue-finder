"use client";

import * as React from "react";

const STORAGE_KEY = "gssoc-issue-finder-owner-issues";

let cachedState: boolean | null = null;
const listeners = new Set<() => void>();

function getOwnerIssuesState(): boolean {
  if (cachedState !== null) return cachedState;
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as boolean;
      cachedState = parsed;
      return parsed;
    }
  } catch {}
  return false;
}

function setGlobalOwnerIssues(next: boolean) {
  cachedState = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedState = null;
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useOwnerIssues() {
  const enabled = React.useSyncExternalStore(subscribe, getOwnerIssuesState, () => false);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    setHasLoaded(true);
  }, []);

  const setEnabled = React.useCallback((val: boolean) => {
    setGlobalOwnerIssues(val);
  }, []);

  const toggle = React.useCallback(() => {
    setGlobalOwnerIssues(!getOwnerIssuesState());
  }, []);

  return {
    enabled,
    hasLoaded,
    setEnabled,
    toggle
  };
}
