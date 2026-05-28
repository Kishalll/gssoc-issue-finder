import { NextResponse } from "next/server";

import {
  EXCLUDED_LABELS,
  GSSOC_ISSUES_URL,
  GSSOC_LABEL_VARIANTS,
  GSSOC_PROJECTS_URL,
  PARENT_ISSUE_LABELS
} from "@/lib/constants";
import type { ApiResponse, FilterState, Issue, Label } from "@/lib/types";

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
};

type GitHubSearchResponse = {
  total_count: number;
  items: GitHubIssueItem[];
};

type GssocProject = {
  repo_url?: string;
  owner_repo?: string;
  gh?: {
    last_push?: string;
    open_issues?: number;
  };
};

type GssocProjectsResponse = {
  projects?: GssocProject[];
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

const requestHeaders = {
  "User-Agent": "GSSoC-Issue-Finder/1.0"
};

const OFFICIAL_REPO_ISSUE_FETCH_CONCURRENCY = 4;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: FilterState = {
    level: searchParams.get("level") ?? "",
    type: searchParams.get("type") ?? ""
  };
  const shouldStream = searchParams.get("stream") === "1";

  if (shouldStream) {
    return streamIssues(request, filters);
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

    const officialIssues = await fetchOfficialProjectIssues(officialProjects, filters);

    if (officialIssues.length > 0) {
      return NextResponse.json(await toApiResponse(officialIssues, filters));
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
      return NextResponse.json(await toApiResponse(filterOfficialIssues(scrapedIssues, officialProjects), filters));
    }
  } catch (error) {
    errors.push(error);
    console.warn(
      `GSSoC page scrape unavailable: ${error instanceof Error ? error.message : String(error)}. Falling back to GitHub Search API.`
    );
  }

  try {
    const githubIssues = await fetchGitHubIssues(filters);
    return NextResponse.json(await toApiResponse(filterOfficialIssues(githubIssues, officialProjects), filters));
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

async function streamIssues(request: Request, filters: FilterState) {
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

        const officialProjects = await fetchOfficialProjects(request.signal);

        if (request.signal.aborted) {
          controller.close();
          return;
        }

        send({
          type: "status",
          message: `Loaded ${officialProjects.size} official repos. Starting repo scan...`
        });

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
            totalRepos: officialProjects.size,
            searchableRepos: officialProjects.size,
            issues: response.issues,
            total: response.total
          });
          controller.close();
          return;
        }

        const repos = Array.from(officialProjects.entries()).filter(
          ([, project]) => (project.gh?.open_issues ?? 1) > 0
        );
        const collectedIssues: NormalizedIssue[] = [];
        const searchableRepos = repos.length;
        let loadedRepos = officialProjects.size - searchableRepos;

        await asyncPool(repos, OFFICIAL_REPO_ISSUE_FETCH_CONCURRENCY, async ([repoName, project]) => {
          if (request.signal.aborted) {
            throw new Error("Request aborted");
          }

          const repoIssues = await fetchRepoIssues(repoName, project, filters, token, request.signal);
          const filteredRepoIssues = repoIssues.filter((issue) => shouldIncludeIssue(issue, filters));
          collectedIssues.push(...filteredRepoIssues);
          loadedRepos += 1;
          const currentLoadedRepos = loadedRepos;

          const prepared = await prepareIssues(collectedIssues, request.signal);

          send({
            type: "progress",
            message: `Loaded ${currentLoadedRepos} of ${officialProjects.size} repos.`,
            loadedRepos: currentLoadedRepos,
            totalRepos: officialProjects.size,
            searchableRepos,
            issues: prepared
          });
        });

        if (request.signal.aborted) {
          controller.close();
          return;
        }

        const response = await prepareApiResponse(collectedIssues, officialProjects.size, searchableRepos, request.signal);
        send(response);
        controller.close();
      } catch (error) {
        if (!request.signal.aborted) {
          console.error("Issue stream failed", error);
          send({
            type: "error",
            message: error instanceof Error ? error.message : "Failed to fetch issues"
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

async function fetchOfficialProjects(signal?: AbortSignal) {
  const response = await fetch(GSSOC_PROJECTS_URL, {
    headers: requestHeaders,
    next: { revalidate: 300 },
    signal
  });

  if (!response.ok) {
    throw new Error(`GSSoC projects API returned ${response.status}`);
  }

  const data = (await response.json()) as GssocProjectsResponse;
  const projects = data.projects ?? [];
  const projectMap = new Map<string, GssocProject>();
  const candidates: Array<[string, GssocProject]> = [];

  for (const project of projects) {
    const repoName = normalizeRepoName(project.owner_repo) ?? extractRepoName(project.repo_url ?? "");

    if (repoName) {
      candidates.push([repoName, project]);
    }
  }

  await asyncPool(candidates, 8, async ([repoName, project]) => {
    if (await hasGssocProjectPage(repoName, signal)) {
      projectMap.set(repoName, project);
    }
  });

  console.info(`Loaded ${projectMap.size} official GSSoC projects with live project pages`);
  return projectMap;
}

async function fetchOfficialProjectIssues(
  officialProjects: Map<string, GssocProject>,
  filters: FilterState,
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
    results.push(await fetchRepoIssues(repoName, project, filters, token, signal));
  });

  return dedupeIssues(results.flat());
}

async function fetchRepoIssues(
  repoName: string,
  project: GssocProject,
  filters: FilterState,
  token: string,
  signal?: AbortSignal
) {
  const firstPage = await fetchRepoIssuePage(repoName, filters, token, 1, signal);
  const linkHeader = firstPage.linkHeader;
  const lastPage = Math.min(getLastPageFromLinkHeader(linkHeader) ?? 1, 10);
  const remainingPages = Array.from({ length: Math.max(lastPage - 1, 0) }, (_, index) => index + 2);
  const remainingItems = await Promise.all(
    remainingPages.map((page) =>
      fetchRepoIssuePage(repoName, filters, token, page, signal).then((result) => result.items)
    )
  );

  return [firstPage.items, ...remainingItems].flat().map((item) => ({
    ...mapGitHubIssue(item),
    repoName,
    gssocProjectUrl: getGssocProjectUrl(repoName),
    lastCommitAt: project.gh?.last_push ?? null
  }));
}

async function fetchRepoIssuePage(
  repoName: string,
  filters: FilterState,
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
  url.searchParams.set("labels", buildRepoIssueLabels(filters));
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

function buildRepoIssueLabels(filters: FilterState) {
  const labels = ["gssoc26"];

  if (filters.level) {
    labels.push(`level:${filters.level}`);
  }

  if (filters.type) {
    labels.push(`type:${filters.type}`);
  }

  return labels.join(",");
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
    assignees: Array.isArray(record.assignees) ? record.assignees : null
  };
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
    throw new Error(
      `GitHub search returned ${response.status}: ${await getGitHubErrorMessage(response)}`
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
    pullRequest: item.pull_request
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
  signal?: AbortSignal
) {
  const prepared = await prepareIssues(issues, signal);

  return {
    type: "complete" as const,
    message: "Search complete.",
    loadedRepos: searchableRepos,
    totalRepos,
    searchableRepos,
    issues: prepared,
    total: prepared.length
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getLastPageFromLinkHeader(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const lastLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.includes('rel="last"'));
  const pageMatch = lastLink?.match(/[?&]page=(\d+)/);

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
  const hasGssocLabel = labelNames.some((labelName) =>
    GSSOC_LABEL_VARIANTS.some((variant) => labelName.includes(variant))
  );
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
    hasGssocLabel &&
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

function extractRepoName(url: string) {
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

function normalizeRepoName(value: string | null | undefined) {
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

function getGssocProjectUrl(repoName: string) {
  const normalizedRepoName = normalizeRepoName(repoName);

  if (!normalizedRepoName) {
    return null;
  }

  return `https://gssoc.girlscript.org/projects/${encodeURIComponent(normalizedRepoName)}`;
}

async function hasGssocProjectPage(repoName: string, signal?: AbortSignal) {
  const projectUrl = getGssocProjectUrl(repoName);

  if (!projectUrl) {
    return false;
  }

  try {
    const response = await fetch(projectUrl, {
      method: "HEAD",
      headers: requestHeaders,
      next: { revalidate: 300 },
      signal
    });

    if (response.ok) {
      return true;
    }

    if (response.status !== 405) {
      return false;
    }

    const getResponse = await fetch(projectUrl, {
      headers: requestHeaders,
      next: { revalidate: 300 },
      signal
    });

    return getResponse.ok;
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    console.warn(`Could not verify GSSoC project page for ${repoName}`, error);
    return false;
  }
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
