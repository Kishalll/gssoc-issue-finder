"use client";

import * as React from "react";

import type { OfficialProject } from "@/lib/types";

interface ProjectsListContextValue {
  projects: OfficialProject[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  setProjects: (projects: OfficialProject[]) => void;
}

const ProjectsListContext = React.createContext<ProjectsListContextValue | null>(null);

interface ProjectsListProviderProps {
  children: React.ReactNode;
}

export function ProjectsListProvider({ children }: ProjectsListProviderProps) {
  const [projects, setProjects] = React.useState<OfficialProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/issues?bootstrap=1", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load official projects (${response.status})`);
        }
        const data = (await response.json()) as { projects: OfficialProject[]; error?: string };
        if (cancelled) {
          return;
        }
        setProjects(data.projects ?? []);
        setError(data.error ?? null);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load official projects"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = React.useCallback(() => {
    setError(null);
    setReloadKey((current) => current + 1);
  }, []);

  const updateProjects = React.useCallback((next: OfficialProject[]) => {
    setProjects(next);
    setError(null);
  }, []);

  const value = React.useMemo<ProjectsListContextValue>(
    () => ({ projects, loading, error, retry, setProjects: updateProjects }),
    [projects, loading, error, retry, updateProjects]
  );

  return <ProjectsListContext.Provider value={value}>{children}</ProjectsListContext.Provider>;
}

export function useProjectsList(): ProjectsListContextValue {
  const context = React.useContext(ProjectsListContext);
  if (!context) {
    throw new Error("useProjectsList must be used within a ProjectsListProvider");
  }
  return context;
}
