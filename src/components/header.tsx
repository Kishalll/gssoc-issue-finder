import { Github } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  rightSlot?: React.ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/60 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background">
            <Github className="h-5 w-5" />
          </div>
          <span className="truncate text-xl font-bold tracking-tight">GSSoC Issue Finder</span>
        </div>
        <div className="flex items-center gap-3">
          {rightSlot}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
