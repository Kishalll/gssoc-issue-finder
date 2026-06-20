import { NextResponse } from "next/server";

import {
  EXCLUDED_LABELS,
  GSSOC_ISSUES_URL,
  PARENT_ISSUE_LABELS
} from "@/lib/constants";
import {
  extractRepoName,
  fetchOfficialProjects,
  friendlyFetchError,
  normalizeRepoName,
  type GssocProject
} from "@/lib/gssoc-projects";
import type { ApiResponse, FilterState, Issue, Label, OfficialProject, WhitelistFilter } from "@/lib/types";

type NormalizedIssue = Issue & {
  assignee?: unknown;
  assignees?: unknown[] | null;
  pullRequest?: unknown;
};

type GitHubLabel = {
  name?: string;
  color?: string;
};

type GitHubIssueItem = {
  number: number;
  title: string;
  body: string | null;
  repository_url: string;
  comments: number;
  labels: GitHubLabel[];
  html_url: string;
  created_at: string;
  assignee?: unknown;
  assignees?: unknown[] | null;
  pull_request?: unknown;
  user?: { login: string };
  author_association?: string;
};

type GitHubSearchResponse = {
  total_count: number;
  items: GitHubIssueItem[];
};

type GitHubCommitResponseItem = {
  commit?: {
    author?: {
      date?: string;
    };
    committer?: {
      date?: string;
    };
  };
};

type RepoMetadata = {
  updated_at: string;
  pushed_at: string;
  open_issues_count: number;
  html_url: string;
};

type RepoIssueCacheEntry = {
  lastFetchedAt: number;
  lastActivityCheckedAt: number;
  activityFingerprint: string;
  issues: NormalizedIssue[];
};

type RepoIssueCacheLookup = {
  issues: NormalizedIssue[] | null;
  metadata?: RepoMetadata;
};

const requestHeaders = {
  "User-Agent": "GSSoC-Issue-Finder/1.0"
};

function friendlyStreamError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("aborted")) {
      return "The request timed out. Please try again.";
    }
    if (error.name === "TypeError" && error.message.toLowerCase().includes("fetch")) {
      return "Network error. Check your connection and try again.";
    }
    if (error.message.includes("rate limit") || error.message.includes("403")) {
      return "GitHub rate limit reached. Add a GitHub token in .env.local or wait a few minutes and try again.";
    }
    if (error.message.includes("401")) {
      return "GitHub token is invalid or expired. Update NEXT_PUBLIC_GITHUB_PAT in .env.local.";
    }
    if (error.message.includes("500") || error.message.includes("502") || error.message.includes("503") || error.message.includes("504")) {
      return "GitHub API is temporarily unavailable. Please try again in a moment.";
    }
  }
  return "Something went wrong while fetching issues. Please try again.";
}

function serializeProjects(projects: Map<string, GssocProject>) {
  return Array.from(projects.entries())
    .map(([repoName, project]) => ({
      repoName,
      openIssues: project.gh?.open_issues ?? 0,
      lastPush: project.gh?.last_push ?? null
    }))
    .sort((left, right) => left.repoName.localeCompare(right.repoName));
}

async function loadProjectsList() {
  try {
    const projects = await fetchOfficialProjects();
    const list = serializeProjects(projects);
    return NextResponse.json({ projects: list, total: list.length });
  } catch (error) {
    console.error("Failed to load official GSSoC projects", error);
    return NextResponse.json(
      { error: friendlyFetchError(error), projects: [], total: 0 },
      { status: 503 }
    );
  }
}

const OFFICIAL_REPO_ISSUE_FETCH_CONCURRENCY = 4;
const REPO_ISSUE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const REPO_ACTIVITY_CHECK_MAX_AGE_MS = 2 * 60 * 1000;
const repoIssueCache = new Map<string, RepoIssueCacheEntry>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: FilterState = {
    level: searchParams.get("level") ?? "",
    type: searchParams.get("type") ?? ""
  };
  const shouldStream = searchParams.get("stream") === "1";
  const isBootstrap = searchParams.get("bootstrap") === "1";
  const whitelistEnabled = searchParams.get("whitelistEnabled") === "1";
  const whitelistParam = searchParams.get("whitelist") ?? "";
  const whitelistRequested = whitelistParam
    .split(",")
    .map((repo) => repo.trim())
    .filter((repo) => repo.length > 0);

  if (isBootstrap) {
    return loadProjectsList();
  }

  if (shouldStream) {
    return streamIssues(request, filters, { enabled: whitelistEnabled, repos: whitelistRequested });
  }

  const errors: unknown[] = [];
  let officialProjects: Map<string, GssocProject> | null = null;

  try {
    officialProjects = await fetchOfficialProjects();
  } catch (error) {
    errors.push(error);
    console.error("Failed to fetch official GSSoC projects", error);
  }

  try {
    if (!officialProjects || officialProjects.size === 0) {
      throw new Error("Official project allowlist is unavailable");
    }

    const { projects: filteredProjects, whitelist } = applyWhitelist(officialProjects, {
      enabled: whitelistEnabled,
      repos: whitelistRequested
    });

    const officialIssues = await fetchOfficialProjectIssues(filteredProjects, request.signal);

    if (officialIssues.length > 0) {
      const response = await toApiResponse(officialIssues, filters);
      return NextResponse.json({ ...response, whitelist });
    }
  } catch (error) {
    errors.push(error);
    console.warn(
      `Official project issue fetch unavailable: ${error instanceof Error ? error.message : String(error)}. Trying GSSoC issue page.`
    );
  }

  try {
    const scrapedIssues = await scrapeGssocIssues();

    if (scrapedIssues.length > 0) {
      const response = await toApiResponse(filterOfficialIssues(scrapedIssues, officialProjects), filters);
      return NextResponse.json(response);
    }
  } catch (error) {
    errors.push(error);
    console.warn(
      `GSSoC page scrape unavailable: ${error instanceof Error ? error.message : String(error)}. Falling back to GitHub Search API.`
    );
  }

  try {
    const githubIssues = await fetchGitHubIssues(filters);
    const response = await toApiResponse(filterOfficialIssues(githubIssues, officialProjects), filters);
    return NextResponse.json(response);
  } catch (error) {
    errors.push(error);
    console.error("GitHub issue search failed", error);
  }

  console.error("All issue fetch strategies failed", errors);

  return NextResponse.json(
    { error: "Failed to fetch issues", issues: [], total: 0 },
    { status: 500 }
  );
}

async function streamIssues(
  request: Request,
  filters: FilterState,
  whitelistInput: { enabled: boolean; repos: string[] }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({
          type: "status",
          message: "Loading official GSSoC repos and matching issues. Please wait."
        });

        const allOfficialProjects = await fetchOfficialProjects();

        if (request.signal.aborted) {
          controller.close();
          return;
        }

        const { projects: officialProjects, whitelist } = applyWhitelist(
          allOfficialProjects,
          whitelistInput
        );

        if (whitelist.fellBackToAll) {
          send({
            type: "fallback",
            message:
              whitelist.requestedRepos.length === 0
                ? "Whitelist is on but empty. Showing all repos."
                : `No valid repos in whitelist (${whitelist.invalidRepos.join(", ")}). Showing all repos.`
          });
        }

        send({
          type: "status",
          message: `Loaded ${allOfficialProjects.size} official repos${
            whitelist.enabled ? `, scanning ${officialProjects.size} whitelisted repos` : ""
          }. Starting repo scan...`
        });

        const officialProjectsList = serializeProjects(allOfficialProjects);

        const token = process.env.NEXT_PUBLIC_GITHUB_PAT?.trim();

        if (!token) {
          send({
            type: "fallback",
            message: "GitHub token missing. Falling back to slower aggregate search."
          });

          const githubIssues = await fetchGitHubIssues(filters, request.signal);
          const response = await toApiResponse(filterOfficialIssues(githubIssues, officialProjects), filters, request.signal);
          send({
            type: "complete",
            message: "Search complete.",
            loadedRepos: officialProjects.size,
            totalRepos: allOfficialProjects.size,
            searchableRepos: officialProjects.size,
            issues: response.issues,
            total: response.total,
            whitelist,
            projects: officialProjectsList
          });
          controller.close();
          return;
        }

        const repos = Array.from(officialProjects.entries()).filter(
          ([, project]) => (project.gh?.open_issues ?? 1) > 0
        );
        const searchableRepos = repos.length;
        const cachedIssues: NormalizedIssue[] = [];
        const reposToFetch: Array<[string, GssocProject, RepoMetadata?]> = [];

        send({
          type: "status",
          message: `Loaded ${allOfficialProjects.size} official repos${
            whitelist.enabled ? `, scanning ${officialProjects.size} whitelisted repos` : ""
          }. Checking repo activity...`
        });

        let loadedRepos = officialProjects.size - searchableRepos;

        await asyncPool(repos, 15, async ([repoName, project]) => {
          if (request.signal.aborted) return;

          const cached = await getCachedRepoIssues(repoName, token, request.signal);

          if (cached.issues) {
            cachedIssues.push(...cached.issues);
            loadedRepos++;
          } else {
            reposToFetch.push([repoName, project, cached.metadata]);
          }
        });

        if (request.signal.aborted) {
          controller.close();
          return;
        }

        const collectedIssues = [...cachedIssues];

        if (cachedIssues.length > 0 || reposToFetch.length === 0) {
          const prepared = await prepareIssues(
            collectedIssues.filter((issue) => shouldIncludeIssue(issue, filters)),
            request.signal
          );

          send({
            type: "progress",
            message:
              reposToFetch.length > 0
                ? `Loaded ${loadedRepos} of ${officialProjects.size} repos from cache. Fetching changed repos...`
                : `Loaded ${loadedRepos} of ${officialProjects.size} repos from cache.`,
            loadedRepos,
            totalRepos: allOfficialProjects.size,
            searchableRepos,
            issues: prepared,
            whitelist,
            projects: officialProjectsList
          });
        }

        await asyncPool(reposToFetch, OFFICIAL_REPO_ISSUE_FETCH_CONCURRENCY, async ([repoName, project, metadata]) => {
          if (request.signal.aborted) {
            throw new Error("Request aborted");
          }

          const repoIssues = await fetchAndCacheRepoIssues(repoName, project, token, request.signal, metadata);
          collectedIssues.push(...repoIssues);
          loadedRepos += 1;
          const currentLoadedRepos = loadedRepos;

          const prepared = await prepareIssues(
            collectedIssues.filter((issue) => shouldIncludeIssue(issue, filters)),
            request.signal
          );

          send({
            type: "progress",
            message: `Loaded ${currentLoadedRepos} of ${officialProjects.size} repos.`,
            loadedRepos: currentLoadedRepos,
            totalRepos: allOfficialProjects.size,
            searchableRepos,
            issues: prepared,
            whitelist,
            projects: officialProjectsList
          });
        });

        if (request.signal.aborted) {
          controller.close();
          return;
        }

        const response = await prepareApiResponse(
          collectedIssues.filter((issue) => shouldIncludeIssue(issue, filters)),
          allOfficialProjects.size,
          searchableRepos,
          whitelist,
          officialProjectsList,
          request.signal
        );
        send(response);
        controller.close();
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("Issue stream failed", error);
          send({
            type: "error",
            message: friendlyStreamError(error)
          });
        }

        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function applyWhitelist(
  officialProjects: Map<string, GssocProject>,
  whitelist: { enabled: boolean; repos: string[] }
): { projects: Map<string, GssocProject>; whitelist: WhitelistFilter } {
  if (!whitelist.enabled) {
    return {
      projects: officialProjects,
      whitelist: {
        enabled: false,
        requestedRepos: [],
        resolvedRepos: [],
        invalidRepos: [],
        fellBackToAll: false
      }
    };
  }

  const requestedRepos = Array.from(
    new Set(whitelist.repos.map((repo) => normalizeRepoName(repo)).filter((repo): repo is string => Boolean(repo)))
  );
  const resolvedRepos: string[] = [];
  const invalidRepos: string[] = [];
  const filtered = new Map<string, GssocProject>();

  for (const repo of requestedRepos) {
    const project = officialProjects.get(repo);
    if (project) {
      filtered.set(repo, project);
      resolvedRepos.push(repo);
    } else {
      invalidRepos.push(repo);
    }
  }

  if (filtered.size === 0) {
    return {
      projects: officialProjects,
      whitelist: {
        enabled: true,
        requestedRepos,
        resolvedRepos,
        invalidRepos,
        fellBackToAll: true
      }
    };
  }

  return {
    projects: filtered,
    whitelist: {
      enabled: true,
      requestedRepos,
      resolvedRepos,
      invalidRepos,
      fellBackToAll: false
    }
  };
}

async function fetchOfficialProjectIssues(
  officialProjects: Map<string, GssocProject>,
  signal?: AbortSignal
) {
  const token = process.env.NEXT_PUBLIC_GITHUB_PAT?.trim();

  if (!token) {
    throw new Error("Full official-repo search requires NEXT_PUBLIC_GITHUB_PAT to avoid GitHub Search API rate limits");
  }

  const repos = Array.from(officialProjects.entries())
    .filter(([, project]) => (project.gh?.open_issues ?? 1) > 0);
  const results: NormalizedIssue[][] = [];

  await asyncPool(repos, OFFICIAL_REPO_ISSUE_FETCH_CONCURRENCY, async ([repoName, project]) => {
    results.push(await getOrFetchRepoIssues(repoName, project, token, signal));
  });

  return dedupeIssues(results.flat());
}

async function getOrFetchRepoIssues(
  repoName: string,
  project: GssocProject,
  token: string,
  signal?: AbortSignal
) {
  const cached = await getCachedRepoIssues(repoName, token, signal);

  if (cached.issues) {
    return cached.issues;
  }

  return fetchAndCacheRepoIssues(repoName, project, token, signal, cached.metadata);
}

async function fetchAndCacheRepoIssues(
  repoName: string,
  project: GssocProject,
  token: string,
  signal?: AbortSignal,
  prefetchedMetadata?: RepoMetadata
) {
  const metadata = prefetchedMetadata ?? (await fetchRepoMetadata(repoName, token, signal));
  const issues = await fetchRepoIssues(repoName, project, token, signal);

  const fingerprint = metadata
    ? `${metadata.updated_at}:${metadata.pushed_at}:${metadata.open_issues_count}`
    : "unknown";

  repoIssueCache.set(repoName, {
    lastFetchedAt: Date.now(),
    lastActivityCheckedAt: Date.now(),
    activityFingerprint: fingerprint,
    issues
  });

  return issues;
}

async function getCachedRepoIssues(
  repoName: string,
  token: string,
  signal?: AbortSignal
): Promise<RepoIssueCacheLookup> {
  const cached = repoIssueCache.get(repoName);

  if (!cached) {
    return { issues: null };
  }

  const now = Date.now();
  const isFresh = now - cached.lastFetchedAt < REPO_ISSUE_CACHE_MAX_AGE_MS;

  if (!isFresh) {
    repoIssueCache.delete(repoName);
    return { issues: null };
  }

  const wasCheckedRecently = now - cached.lastActivityCheckedAt < REPO_ACTIVITY_CHECK_MAX_AGE_MS;

  if (wasCheckedRecently) {
    return { issues: cached.issues };
  }

  const metadata = await fetchRepoMetadata(repoName, token, signal);

  if (!metadata) {
    return { issues: null };
  }

  const fingerprint = `${metadata.updated_at}:${metadata.pushed_at}:${metadata.open_issues_count}`;

  if (cached.activityFingerprint !== fingerprint) {
    return { issues: null, metadata };
  }

  cached.lastActivityCheckedAt = now;
  return { issues: cached.issues };
}

async function fetchRepoMetadata(repoName: string, token?: string, signal?: AbortSignal) {
  const [owner, repo] = repoName.split("/");
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  );

  const response = await fetch(url, {
    headers: getGitHubHeaders(token),
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    const message = await getGitHubErrorMessage(response);
    console.warn(`Could not fetch metadata for ${repoName}: ${response.status} ${message}`);
    return null;
  }

  return (await response.json()) as RepoMetadata;
}

async function fetchRepoIssues(
  repoName: string,
  project: GssocProject,
  token: string,
  signal?: AbortSignal
) {
  const allItems: GitHubIssueItem[] = [];
  let page = 1;

  while (page) {
    if (signal?.aborted) {
      throw new Error("Request aborted");
    }

    const result = await fetchRepoIssuePage(repoName, token, page, signal);
    allItems.push(...result.items);
    page = getNextPageFromLinkHeader(result.linkHeader) ?? 0;
  }

  return allItems.map((item) => ({
    ...mapGitHubIssue(item),
    repoName,
    gssocProjectUrl: getGssocProjectUrl(repoName),
    lastCommitAt: project.gh?.last_push ?? null
  }));
}

async function fetchRepoIssuePage(
  repoName: string,
  token: string,
  page: number,
  signal?: AbortSignal
) {
  const [owner, repo] = repoName.split("/");
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`
  );
  url.searchParams.set("state", "open");
  url.searchParams.set("assignee", "none");
  url.searchParams.set("sort", "comments");
  url.searchParams.set("direction", "asc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: getGitHubHeaders(token),
    next: { revalidate: 300 },
    signal
  });

  if (!response.ok) {
    const message = await getGitHubErrorMessage(response);
    console.warn(`Could not fetch issues for ${repoName}: ${response.status} ${message}`);
    return { items: [], linkHeader: null };
  }

  return {
    items: (await response.json()) as GitHubIssueItem[],
    linkHeader: response.headers.get("link")
  };
}

function filterOfficialIssues(
  issues: NormalizedIssue[],
  officialProjects: Map<string, GssocProject> | null
) {
  if (!officialProjects || officialProjects.size === 0) {
    return [];
  }

  return issues
    .map((issue) => {
      const repoName = normalizeRepoName(issue.repoName);
      const officialProject = repoName ? officialProjects.get(repoName) : null;

      if (!repoName || !officialProject) {
        return null;
      }

      return {
        ...issue,
        repoName,
        gssocProjectUrl: getGssocProjectUrl(repoName),
        lastCommitAt: issue.lastCommitAt ?? officialProject.gh?.last_push ?? null
      };
    })
    .filter((issue): issue is NormalizedIssue => issue !== null);
}

async function scrapeGssocIssues() {
  const response = await fetch(GSSOC_ISSUES_URL, {
    headers: requestHeaders,
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`GSSoC page returned ${response.status}`);
  }

  const html = await response.text();
  const nextData = extractNextData(html);

  if (!nextData) {
    throw new Error("__NEXT_DATA__ script was not found");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(nextData);
  } catch (error) {
    throw new Error(`Could not parse __NEXT_DATA__: ${String(error)}`);
  }

  console.info("GSSoC NEXT_DATA top-level keys", Object.keys(asRecord(parsed)));

  const issueArrays = findIssueArrays(parsed);
  const normalized = issueArrays
    .flatMap((items) => items.map(normalizeScrapedIssue))
    .filter((issue): issue is NormalizedIssue => issue !== null);

  if (normalized.length === 0) {
    throw new Error("No issue-like arrays found in __NEXT_DATA__");
  }

  return dedupeIssues(normalized);
}

function extractNextData(html: string) {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
  );

  return match?.[1]?.trim() ?? null;
}

function findIssueArrays(value: unknown) {
  const arrays: unknown[][] = [];
  const seen = new WeakSet<object>();

  function walk(current: unknown, path: string) {
    if (!current || typeof current !== "object") {
      return;
    }

    if (seen.has(current)) {
      return;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      if (looksLikeIssueArray(current)) {
        console.info("Found issue-like array in GSSoC data", path, current.length);
        arrays.push(current);
        return;
      }

      current.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    Object.entries(current).forEach(([key, child]) => walk(child, path ? `${path}.${key}` : key));
  }

  walk(value, "");
  return arrays;
}

function looksLikeIssueArray(value: unknown[]) {
  if (value.length === 0) {
    return false;
  }

  const sample = value.slice(0, 5).filter((item) => item && typeof item === "object");

  return sample.some((item) => {
    const record = asRecord(item);
    return (
      typeof record.title === "string" &&
      (Array.isArray(record.labels) ||
        typeof record.url === "string" ||
        typeof record.html_url === "string" ||
        typeof record.repository_url === "string")
    );
  });
}

function normalizeScrapedIssue(raw: unknown): NormalizedIssue | null {
  const record = asRecord(raw);
  const title = stringValue(record.title);
  const url = stringValue(record.url) ?? stringValue(record.html_url) ?? stringValue(record.issueUrl);

  if (!title || !url) {
    return null;
  }

  const repository = asRecord(record.repository);
  const repoName =
    stringValue(record.repoName) ??
    stringValue(record.repo) ??
    stringValue(record.repositoryName) ??
    stringValue(repository.full_name) ??
    stringValue(repository.nameWithOwner) ??
    extractRepoName(url) ??
    "unknown/repository";

  return {
    id: stringValue(record.id) ?? `${repoName}-${url}`,
    title,
    body: stringValue(record.body) ?? stringValue(record.description),
    repoName,
    gssocProjectUrl: null,
    comments: numberValue(record.comments) ?? numberValue(record.commentsCount) ?? 0,
    labels: normalizeLabels(record.labels),
    url,
    createdAt:
      stringValue(record.createdAt) ??
      stringValue(record.created_at) ??
      stringValue(record.created) ??
      new Date().toISOString(),
    lastCommitAt:
      stringValue(record.lastCommitAt) ??
      stringValue(record.last_commit_at) ??
      stringValue(record.pushedAt) ??
      stringValue(record.pushed_at),
    assignee: record.assignee,
    assignees: Array.isArray(record.assignees) ? record.assignees : null,
    isOwnerIssue: getIsOwnerIssueScraped(record, repoName)
  };
}

function getIsOwnerIssueScraped(record: Record<string, unknown>, repoName: string) {
  const authorAssociation = stringValue(record.author_association) ?? stringValue(record.authorAssociation);
  if (authorAssociation === "OWNER") return true;

  const user = asRecord(record.user);
  const userLogin = stringValue(user.login) ?? stringValue(record.author) ?? stringValue(record.creator);
  const [owner] = repoName.split("/");
  if (userLogin && owner && userLogin.toLowerCase() === owner.toLowerCase()) return true;

  return false;
}

async function fetchGitHubIssues(filters: FilterState, signal?: AbortSignal) {
  const firstPage = await fetchGitHubSearchPage(filters, 1, signal);
  const totalPages = Math.min(Math.ceil(firstPage.total_count / 100), 10);
  const remainingPages = Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => index + 2);
  const remainingResults = await Promise.all(
    remainingPages.map((page) => fetchGitHubSearchPage(filters, page, signal))
  );

  return [firstPage, ...remainingResults].flatMap((result) =>
    result.items.map(mapGitHubIssue)
  );
}

async function fetchGitHubSearchPage(filters: FilterState, page: number, signal?: AbortSignal) {
  const queryParts = ["label:gssoc26", "no:assignee", "state:open", "type:issue"];

  if (filters.level) {
    queryParts.push(`label:"level:${filters.level}"`);
  }

  if (filters.type) {
    queryParts.push(`label:"type:${filters.type}"`);
  }

  return fetchGitHubSearchUrl(queryParts, page, undefined, signal);
}

async function fetchGitHubSearchUrl(
  queryParts: string[],
  page: number,
  token?: string,
  signal?: AbortSignal
) {
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", queryParts.join(" "));
  url.searchParams.set("sort", "comments");
  url.searchParams.set("order", "asc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  const headers = getGitHubHeaders(token ?? process.env.NEXT_PUBLIC_GITHUB_PAT?.trim());
  const response = await fetch(url, { headers, signal });

  if (!response.ok) {
    const message = await getGitHubErrorMessage(response);
    if (response.status === 403 || response.status === 429) {
      throw new Error(`GitHub rate limit reached. Add a GitHub token in .env.local or wait a few minutes and try again.`);
    }
    if (response.status === 401) {
      throw new Error("GitHub token is invalid or expired. Update NEXT_PUBLIC_GITHUB_PAT in .env.local.");
    }
    throw new Error(
      `GitHub search returned ${response.status}: ${message}`
    );
  }

  return (await response.json()) as GitHubSearchResponse;
}

function mapGitHubIssue(item: GitHubIssueItem): NormalizedIssue {
  return {
    id: `${item.repository_url}-${item.number}`,
    title: item.title,
    body: item.body,
    repoName: extractRepoName(item.repository_url) ?? "unknown/repository",
    gssocProjectUrl: null,
    comments: item.comments,
    labels: item.labels.map((label) => ({
      name: label.name ?? "",
      color: label.color ?? "6b7280"
    })),
    url: item.html_url,
    createdAt: item.created_at,
    lastCommitAt: null,
    assignee: item.assignee,
    assignees: item.assignees,
    pullRequest: item.pull_request,
    isOwnerIssue: item.author_association === "OWNER" || (Boolean(item.user?.login) && extractRepoName(item.repository_url)?.split("/")[0].toLowerCase() === item.user?.login.toLowerCase())
  };
}

async function toApiResponse(
  issues: NormalizedIssue[],
  filters: FilterState,
  signal?: AbortSignal
): Promise<ApiResponse> {
  const filteredIssues = issues
    .filter((issue) => shouldIncludeIssue(issue, filters))
    .map(({ assignee: _assignee, assignees: _assignees, pullRequest: _pullRequest, ...issue }) => issue);
  const issuesWithCommitDates = await enrichIssuesWithLastCommitDates(filteredIssues, signal);
  const filteredSortedIssues = issuesWithCommitDates.sort((left, right) => sortIssues(left, right));

  return {
    issues: filteredSortedIssues,
    total: filteredSortedIssues.length
  };
}

async function prepareApiResponse(
  issues: NormalizedIssue[],
  totalRepos: number,
  searchableRepos: number,
  whitelist: WhitelistFilter,
  projects: OfficialProject[],
  signal?: AbortSignal
) {
  const prepared = await prepareIssues(issues, signal);

  return {
    type: "complete" as const,
    message: "Search complete.",
    loadedRepos: totalRepos,
    totalRepos,
    searchableRepos,
    issues: prepared,
    total: prepared.length,
    whitelist,
    projects
  };
}

async function prepareIssues(issues: NormalizedIssue[], signal?: AbortSignal) {
  const strippedIssues = dedupeIssues(issues).map(
    ({ assignee: _assignee, assignees: _assignees, pullRequest: _pullRequest, ...issue }) => issue
  );
  const issuesWithCommitDates = await enrichIssuesWithLastCommitDates(strippedIssues, signal);
  return issuesWithCommitDates.sort((left, right) => sortIssues(left, right));
}

async function enrichIssuesWithLastCommitDates<T extends Issue>(issues: T[], signal?: AbortSignal) {
  const missingRepoNames = Array.from(
    new Set(
      issues
        .filter((issue) => !issue.lastCommitAt)
        .map((issue) => issue.repoName)
        .filter((repoName) => /^[^/\s]+\/[^/\s]+$/.test(repoName))
    )
  );

  if (missingRepoNames.length === 0) {
    return issues;
  }

  const repoDates = new Map<string, string | null>();
  const token = process.env.NEXT_PUBLIC_GITHUB_PAT?.trim();

  await asyncPool(missingRepoNames, 8, async (repoName) => {
    repoDates.set(repoName, await fetchRepoLastCommitDate(repoName, token, signal));
  });

  return issues.map((issue) => ({
    ...issue,
    lastCommitAt: issue.lastCommitAt ?? repoDates.get(issue.repoName) ?? null
  }));
}

async function fetchRepoLastCommitDate(repoName: string, token?: string, signal?: AbortSignal) {
  const [owner, repo] = repoName.split("/");
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`
  );
  url.searchParams.set("per_page", "1");

  const response = await fetch(url, {
    headers: getGitHubHeaders(token),
    next: { revalidate: 300 },
    signal
  });

  if (!response.ok) {
    console.warn(`Could not fetch latest commit for ${repoName}: ${response.status}`);
    return null;
  }

  const commits = (await response.json()) as GitHubCommitResponseItem[];
  const latest = commits.at(0);

  return latest?.commit?.committer?.date ?? latest?.commit?.author?.date ?? null;
}

async function asyncPool<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
) {
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const promise = task(item).finally(() => executing.delete(promise));
    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

function getNextPageFromLinkHeader(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.includes('rel="next"'));
  const pageMatch = nextLink?.match(/[?&]page=(\d+)/);

  return pageMatch ? Number(pageMatch[1]) : null;
}

async function getGitHubErrorMessage(response: Response) {
  try {
    const body = (await response.clone().json()) as { message?: string };
    return body.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function sortIssues(left: Issue, right: Issue) {
  if (left.isOwnerIssue && !right.isOwnerIssue) {
    return -1;
  }
  if (!left.isOwnerIssue && right.isOwnerIssue) {
    return 1;
  }

  if (left.comments !== right.comments) {
    return left.comments - right.comments;
  }

  return getTime(right.lastCommitAt) - getTime(left.lastCommitAt);
}

function getTime(value: string | null) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getGitHubHeaders(token?: string) {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    ...requestHeaders
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function shouldIncludeIssue(issue: NormalizedIssue, filters: FilterState) {
  const labelNames = issue.labels.map((label) => label.name.toLowerCase());
  const hasExcludedLabel = labelNames.some((labelName) =>
    EXCLUDED_LABELS.some((excluded) => labelName.includes(excluded))
  );
  const isParentIssue = isParentOrTrackingIssue(issue, labelNames);
  const hasAssignee =
    Boolean(issue.assignee) || (Array.isArray(issue.assignees) && issue.assignees.length > 0);
  const isPullRequest = Boolean(issue.pullRequest) || issue.url.includes("/pull/");
  const hasLevel = filters.level
    ? labelNames.some((labelName) => labelName.includes(`level:${filters.level.toLowerCase()}`))
    : true;
  const hasType = filters.type
    ? labelNames.some((labelName) => labelName.includes(`type:${filters.type.toLowerCase()}`))
    : true;

  return (
    !hasExcludedLabel &&
    !isParentIssue &&
    !hasAssignee &&
    !isPullRequest &&
    hasLevel &&
    hasType
  );
}

function isParentOrTrackingIssue(issue: NormalizedIssue, labelNames: string[]) {
  const hasParentLabel = labelNames.some((labelName) =>
    PARENT_ISSUE_LABELS.some((parentLabel) => labelName.includes(parentLabel))
  );

  if (hasParentLabel) {
    return true;
  }

  const searchableText = `${issue.title}\n${issue.body ?? ""}`.toLowerCase();

  return [
    /\bparent\s+(?:roadmap\s+)?issue\b/,
    /\btracking\s+issue\b/,
    /\bmeta\s+issue\b/,
    /\bepic\s+issue\b/,
    /\bchild\s+issues?\b/,
    /\bsub[-\s]?issues?\b/,
    /\bcontributors?\s+should\s+pick\s+one\s+child\s+issue\b/
  ].some((pattern) => pattern.test(searchableText));
}

function normalizeLabels(value: unknown): Label[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((label) => {
      if (typeof label === "string") {
        return { name: label, color: "6b7280" };
      }

      const record = asRecord(label);
      const name = stringValue(record.name);

      if (!name) {
        return null;
      }

      return {
        name,
        color: stringValue(record.color) ?? "6b7280"
      };
    })
    .filter((label): label is Label => label !== null);
}

function dedupeIssues(issues: NormalizedIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = issue.url || issue.id;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getGssocProjectUrl(repoName: string) {
  const normalizedRepoName = normalizeRepoName(repoName);

  if (!normalizedRepoName) {
    return null;
  }

  return `https://gssoc.girlscript.org/projects/${encodeURIComponent(normalizedRepoName)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
