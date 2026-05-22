"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { DIFFICULTY_OPTIONS, PRIORITY_OPTIONS } from "@/lib/constants";
import type { FilterState } from "@/lib/types";

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export function FilterBar({ filters, onFilterChange, onSearch, isLoading }: FilterBarProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Difficulty</span>
        <Select
          value={filters.difficulty || "all"}
          onValueChange={(value) =>
            onFilterChange({ ...filters, difficulty: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All difficulties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            {DIFFICULTY_OPTIONS.map((difficulty) => (
              <SelectItem key={difficulty} value={difficulty}>
                {capitalize(difficulty)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Priority</span>
        <Select
          value={filters.priority || "all"}
          onValueChange={(value) =>
            onFilterChange({ ...filters, priority: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITY_OPTIONS.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {capitalize(priority)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <Button
        type="button"
        onClick={onSearch}
        disabled={isLoading}
        className="mt-0 h-11 gap-2 md:mt-7 md:min-w-36"
      >
        <Search className="h-4 w-4" />
        {isLoading ? "Searching..." : "Search"}
      </Button>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
