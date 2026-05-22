import { Github } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b bg-card/92 backdrop-blur supports-[backdrop-filter]:bg-card/78">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Github className="h-5 w-5" />
          </div>
          <span className="truncate text-xl font-bold tracking-tight">GSSoC Issue Finder</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
