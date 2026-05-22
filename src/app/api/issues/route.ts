import { NextResponse } from "next/server";

import {
  EXCLUDED_LABELS,
  GSSOC_ISSUES_URL,
  GSSOC_LABEL_VARIANTS
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

const requestHeaders = {
  "User-Agent": "GSSoC-Issue-Finder/1.0"
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: FilterState = {
    difficulty: searchParams.get("difficulty") ?? "",
    priority: searchParams.get("priority") ?? ""
  };

  const errors: unknown[] = [];

  try {
    const scrapedIssues = await scrapeGssocIssues();

    if (scrapedIssues.length > 0) {
      return NextResponse.json(toApiResponse(scrapedIssues, filters));
    }
  } catch (error) {
    errors.push(error);
    console.error("GSSoC page scrape failed", error);
  }

  try {
    const githubIssues = await fetchGitHubIssues(filters);
    return NextResponse.json(toApiResponse(githubIssues, filters));
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
    comments: numberValue(record.comments) ?? numberValue(record.commentsCount) ?? 0,
    labels: normalizeLabels(record.labels),
    url,
    createdAt:
      stringValue(record.createdAt) ??
      stringValue(record.created_at) ??
      stringValue(record.created) ??
      new Date().toISOString(),
    assignee: record.assignee,
    assignees: Array.isArray(record.assignees) ? record.assignees : null
  };
}

async function fetchGitHubIssues(filters: FilterState) {
  const firstPage = await fetchGitHubSearchPage(filters, 1);
  const totalPages = Math.min(Math.ceil(firstPage.total_count / 100), 10);
  const remainingPages = Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => index + 2);
  const remainingResults = await Promise.all(
    remainingPages.map((page) => fetchGitHubSearchPage(filters, page))
  );

  return [firstPage, ...remainingResults].flatMap((result) =>
    result.items.map(mapGitHubIssue)
  );
}

async function fetchGitHubSearchPage(filters: FilterState, page: number) {
  const queryParts = ["label:gssoc26", "no:assignee", "state:open", "type:issue"];

  if (filters.difficulty) {
    queryParts.push(`label:${filters.difficulty}`);
  }

  if (filters.priority) {
    queryParts.push(`label:${filters.priority}`);
  }

  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", queryParts.join(" "));
  url.searchParams.set("sort", "comments");
  url.searchParams.set("order", "asc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));

  const token = process.env.NEXT_PUBLIC_GITHUB_PAT?.trim();
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    ...requestHeaders
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub search returned ${response.status}`);
  }

  return (await response.json()) as GitHubSearchResponse;
}

function mapGitHubIssue(item: GitHubIssueItem): NormalizedIssue {
  return {
    id: `${item.repository_url}-${item.number}`,
    title: item.title,
    body: item.body,
    repoName: extractRepoName(item.repository_url) ?? "unknown/repository",
    comments: item.comments,
    labels: item.labels.map((label) => ({
      name: label.name ?? "",
      color: label.color ?? "6b7280"
    })),
    url: item.html_url,
    createdAt: item.created_at,
    assignee: item.assignee,
    assignees: item.assignees,
    pullRequest: item.pull_request
  };
}

function toApiResponse(issues: NormalizedIssue[], filters: FilterState): ApiResponse {
  const filteredSortedIssues = issues
    .filter((issue) => shouldIncludeIssue(issue, filters))
    .sort((left, right) => left.comments - right.comments)
    .map(({ assignee: _assignee, assignees: _assignees, pullRequest: _pullRequest, ...issue }) => issue);

  return {
    issues: filteredSortedIssues,
    total: filteredSortedIssues.length
  };
}

function shouldIncludeIssue(issue: NormalizedIssue, filters: FilterState) {
  const labelNames = issue.labels.map((label) => label.name.toLowerCase());
  const hasExcludedLabel = labelNames.some((labelName) =>
    EXCLUDED_LABELS.some((excluded) => labelName.includes(excluded))
  );
  const hasGssocLabel = labelNames.some((labelName) =>
    GSSOC_LABEL_VARIANTS.some((variant) => labelName.includes(variant))
  );
  const hasAssignee =
    Boolean(issue.assignee) || (Array.isArray(issue.assignees) && issue.assignees.length > 0);
  const isPullRequest = Boolean(issue.pullRequest) || issue.url.includes("/pull/");
  const hasDifficulty = filters.difficulty
    ? labelNames.some((labelName) => labelName.includes(filters.difficulty.toLowerCase()))
    : true;
  const hasPriority = filters.priority
    ? labelNames.some((labelName) => labelName.includes(filters.priority.toLowerCase()))
    : true;

  return (
    !hasExcludedLabel &&
    hasGssocLabel &&
    !hasAssignee &&
    !isPullRequest &&
    hasDifficulty &&
    hasPriority
  );
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
