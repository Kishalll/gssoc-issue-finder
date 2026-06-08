"use client";

import * as React from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PatAlert() {
  const [isVisible, setIsVisible] = React.useState(true);
  const [patStatus, setPatStatus] = React.useState<"checking" | "missing" | "invalid" | "valid">("checking");

  React.useEffect(() => {
    const pat = process.env.NEXT_PUBLIC_GITHUB_PAT;
    if (!pat || pat.trim() === "") {
      setPatStatus("missing");
      return;
    }

    // Verify the PAT
    fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${pat}`
      }
    })
      .then((res) => {
        if (res.status === 401) {
          setPatStatus("invalid");
        } else {
          setPatStatus("valid");
        }
      })
      .catch(() => {
        // If network error, we don't show the invalid alert
        setPatStatus("valid");
      });
  }, []);

  if (!isVisible || patStatus === "checking" || patStatus === "valid") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-lg border bg-card p-6 shadow-lg sm:p-8">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
            {patStatus === "missing" ? "Missing GitHub PAT" : "Invalid GitHub PAT"}
          </h2>
          <div className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {patStatus === "missing" ? (
              <p>
                You haven&apos;t set a NEXT_PUBLIC_GITHUB_PAT in your .env.local file. Without a token, your searches will be severely rate-limited by GitHub and <span className="font-bold text-destructive">YOU WILL SEE FEWER RESULTS TO YOUR SEARCHES.</span>
              </p>
            ) : (
              <p>
                The NEXT_PUBLIC_GITHUB_PAT in your .env.local file is invalid or expired. Your searches will fail or be heavily rate-limited and <span className="font-bold text-destructive">YOU WILL SEE FEWER RESULTS TO YOUR SEARCHES.</span>
              </p>
            )}
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() => setIsVisible(false)}
          >
            I understand, let me in
          </Button>
        </div>
      </div>
    </div>
  );
}
