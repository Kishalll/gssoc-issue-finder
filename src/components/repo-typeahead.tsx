"use client";

import { Check, Search } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import type { OfficialProject } from "@/lib/types";

interface RepoTypeaheadProps {
  allRepos: OfficialProject[];
  selectedRepos: string[];
  onSelect: (repoName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_RESULTS = 25;

function matchRepos(query: string, repos: OfficialProject[], exclude: Set<string>) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return [] as OfficialProject[];
  }

  const prefixMatches: OfficialProject[] = [];
  const substringMatches: OfficialProject[] = [];

  for (const repo of repos) {
    if (exclude.has(repo.repoName)) {
      continue;
    }

    const name = repo.repoName.toLowerCase();

    if (name.startsWith(q)) {
      prefixMatches.push(repo);
    } else if (name.includes(q)) {
      substringMatches.push(repo);
    }

    if (prefixMatches.length >= MAX_RESULTS) {
      break;
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, MAX_RESULTS);
}

export function RepoTypeahead({
  allRepos,
  selectedRepos,
  onSelect,
  disabled = false,
  placeholder = "Search official repos to add..."
}: RepoTypeaheadProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const exclude = React.useMemo(() => new Set(selectedRepos), [selectedRepos]);
  const matches = React.useMemo(
    () => matchRepos(query, allRepos, exclude),
    [query, allRepos, exclude]
  );

  React.useEffect(() => {
    setHighlight(0);
  }, [query, matches.length]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const choose = (repoName: string) => {
    onSelect(repoName);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (!open || matches.length === 0) {
        return;
      }
      event.preventDefault();
      const picked = matches[highlight];
      if (picked) {
        choose(picked.repoName);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && query.trim().length > 0;
  const hasNoMatches = showDropdown && matches.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="pl-10"
        />
      </div>
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {hasNoMatches ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No matching repos in the official GSSoC list.
            </p>
          ) : (
            <ul role="listbox" className="py-1">
              {matches.map((repo, index) => {
                const isActive = index === highlight;
                return (
                  <li key={repo.repoName} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => choose(repo.repoName)}
                      onMouseEnter={() => setHighlight(index)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate font-mono text-xs">{repo.repoName}</span>
                      {repo.openIssues > 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {repo.openIssues} open
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {selectedRepos.length > 0 && !showDropdown ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          {selectedRepos.length} repo{selectedRepos.length === 1 ? "" : "s"} whitelisted
        </p>
      ) : null}
    </div>
  );
}
