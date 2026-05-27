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

export interface BlacklistedIssue {
  id: string;
  title: string;
  repoName: string;
}

export interface BlacklistState {
  repos: string[];
  issues: BlacklistedIssue[];
}
