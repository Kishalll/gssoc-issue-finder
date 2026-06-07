"use client";

import { cn } from "@/lib/utils";

export type TabId = "home" | "config";

interface TabsProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  items: Array<{ id: TabId; label: string }>;
}

export function Tabs({ active, onChange, items }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="inline-flex items-center gap-1 rounded-md border bg-muted/40 p-1"
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex h-8 items-center rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
