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
import { LEVEL_OPTIONS, TYPE_OPTIONS } from "@/lib/constants";
import type { FilterState } from "@/lib/types";

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onSearch: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function FilterBar({
  filters,
  onFilterChange,
  onSearch,
  onCancel,
  isLoading
}: FilterBarProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Level</span>
        <Select
          value={filters.level || "all"}
          onValueChange={(value) =>
            onFilterChange({ ...filters, level: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {LEVEL_OPTIONS.map((level) => (
              <SelectItem key={level} value={level}>
                {capitalize(level)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">Type</span>
        <Select
          value={filters.type || "all"}
          onValueChange={(value) =>
            onFilterChange({ ...filters, type: value === "all" ? "" : value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {formatType(type)}
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

      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={!isLoading}
        className="mt-0 h-11 md:mt-7 md:min-w-28"
      >
        Cancel
      </Button>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatType(value: string) {
  return value === "devops" ? "DevOps" : capitalize(value);
}
