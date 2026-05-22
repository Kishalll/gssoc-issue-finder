export const GSSOC_LABEL_VARIANTS = [
  "gssoc26",
  "gssoc'26",
  "gssoc 26",
  "gssoc-2026",
  "gssoc_2026",
  "gssoc' 26"
] as const;

export const LEVEL_OPTIONS = ["beginner", "intermediate", "advanced", "critical"] as const;

export const TYPE_OPTIONS = [
  "bug",
  "feature",
  "docs",
  "testing",
  "security",
  "performance",
  "design",
  "refactor",
  "devops",
  "accessibility"
] as const;

export const EXCLUDED_LABELS = ["invalid", "wontfix", "duplicate", "spam"] as const;

export const GSSOC_ISSUES_URL = "https://gssoc.girlscript.org/issues";

export const PAGE_SIZE = 50;
