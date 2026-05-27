export interface Label {
  name: string;
  color: string;
}

export interface Issue {
  id: string;
  title: string;
  body: string | null;
  repoName: string;
  comments: number;
  labels: Label[];
  url: string;
  createdAt: string;
  lastCommitAt: string | null;
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
    }
  | {
      type: "complete";
      message: string;
      loadedRepos: number;
      totalRepos: number;
      searchableRepos: number;
      issues: Issue[];
      total: number;
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
