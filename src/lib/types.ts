export interface Label {
  name: string;
  color: string;
}

export interface Issue {
  id: string;
  title: string;
  body: string | null;
  repoName: string;
  gssocProjectUrl: string | null;
  comments: number;
  labels: Label[];
  url: string;
  createdAt: string;
  lastCommitAt: string | null;
  isOwnerIssue: boolean;
}

export interface FilterState {
  level: string;
  type: string;
}

export interface ApiResponse {
  issues: Issue[];
  total: number;
}

export interface IssueProgressState {
  loadedRepos: number;
  totalRepos: number;
  searchableRepos: number;
}

export type IssueStreamEvent =
  | {
      type: "status";
      message: string;
    }
  | {
      type: "progress";
      message: string;
      loadedRepos: number;
      totalRepos: number;
      searchableRepos: number;
      issues: Issue[];
      whitelist?: WhitelistFilter;
      projects?: OfficialProject[];
    }
  | {
      type: "complete";
      message: string;
      loadedRepos: number;
      totalRepos: number;
      searchableRepos: number;
      issues: Issue[];
      total: number;
      whitelist?: WhitelistFilter;
      projects?: OfficialProject[];
    }
  | {
      type: "fallback";
      message: string;
    }
  | {
      type: "error";
      message: string;
    };

export interface BlacklistedIssue {
  id: string;
  title: string;
  repoName: string;
}

export interface BlacklistState {
  repos: string[];
  issues: BlacklistedIssue[];
}

export interface WhitelistState {
  enabled: boolean;
  repos: string[];
}

export interface OfficialProject {
  repoName: string;
  openIssues: number;
  lastPush: string | null;
}

export interface WhitelistFilter {
  enabled: boolean;
  requestedRepos: string[];
  resolvedRepos: string[];
  invalidRepos: string[];
  fellBackToAll: boolean;
}
