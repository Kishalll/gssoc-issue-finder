import { GSSOC_PROJECTS_URL } from "@/lib/constants";

const requestHeaders = {
  "User-Agent": "GSSoC-Issue-Finder/1.0"
};

export type GssocProject = {
  repo_url?: string;
  owner_repo?: string;
  gh?: {
    last_push?: string;
    open_issues?: number;
  };
};

export type GssocProjectsResponse = {
  projects?: GssocProject[];
};

type OfficialProjectCacheEntry = {
  fetchedAt: number;
  projects: Map<string, GssocProject>;
};

const OFFICIAL_PROJECT_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const OFFICIAL_PROJECT_FETCH_TIMEOUT_MS = 8000;
let officialProjectCache: OfficialProjectCacheEntry | null = null;

export async function fetchOfficialProjects(signal?: AbortSignal) {
  if (
    officialProjectCache &&
    Date.now() - officialProjectCache.fetchedAt < OFFICIAL_PROJECT_CACHE_MAX_AGE_MS
  ) {
    return officialProjectCache.projects;
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), OFFICIAL_PROJECT_FETCH_TIMEOUT_MS);
  const combinedSignal = signal
    ? mergeAbortSignals(signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const response = await fetch(GSSOC_PROJECTS_URL, {
      headers: requestHeaders,
      next: { revalidate: 300 },
      signal: combinedSignal
    });

    if (!response.ok) {
      throw new Error(`GSSoC projects API returned ${response.status}`);
    }

    const data = (await response.json()) as GssocProjectsResponse;
    const projects = data.projects ?? [];
    const projectMap = new Map<string, GssocProject>();

    for (const project of projects) {
      const repoName = normalizeRepoName(project.owner_repo) ?? extractRepoName(project.repo_url ?? "");

      if (repoName) {
        projectMap.set(repoName, project);
      }
    }

    officialProjectCache = {
      fetchedAt: Date.now(),
      projects: projectMap
    };

    return projectMap;
  } finally {
    clearTimeout(timeoutId);
  }
}

function mergeAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export function normalizeRepoName(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  const parts = cleaned.split("/");

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return `${parts[0]}/${parts[1]}`;
}

export function extractRepoName(url: string) {
  const normalized = normalizeRepoName(url);

  if (normalized) {
    return normalized;
  }

  const cleaned = url.replace(/\/+$/, "");
  const parts = cleaned.split("/");
  const githubHostIndex = parts.findIndex((part) => part === "github.com");

  if (githubHostIndex >= 0) {
    const owner = parts.at(githubHostIndex + 1);
    const repo = parts.at(githubHostIndex + 2);

    return owner && repo ? `${owner}/${repo}` : null;
  }

  const reposIndex = parts.findIndex((part) => part === "repos");

  if (reposIndex >= 0) {
    const owner = parts.at(reposIndex + 1);
    const repo = parts.at(reposIndex + 2);

    return owner && repo ? `${owner}/${repo}` : null;
  }

  const repo = parts.at(-1);
  const owner = parts.at(-2);

  if (!owner || !repo) {
    return null;
  }

  return `${owner}/${repo}`;
}
