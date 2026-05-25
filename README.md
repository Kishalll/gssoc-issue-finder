# GSSoC Issue Finder

App for finding open, unassigned GitHub issues labelled for GSSoC 2026.

## Tech Stack

- Next.js 14, App Router
- TypeScript
- Tailwind CSS v3
- shadcn/ui-style components
- next-themes
- lucide-react

## Requirements

- Node.js 18.17 or newer
- npm
- GitHub personal access token recommended for complete results

## Setup

Install dependencies:

```bash
npm install
```

Create or update `.env.local`:

```bash
NEXT_PUBLIC_GITHUB_PAT=
```

The token lets the app search across all 313 official GSSoC project repos without hitting GitHub's low unauthenticated search limit. Without a token, results are still filtered to official repos, but GitHub may return fewer results or rate-limit requests. The official project list is loaded from `https://gssoc.girlscript.org/api/projects`.

For a classic GitHub token:

- Leave all scopes unchecked.
- Do not select `repo`, `public_repo`, `workflow`, `project`, `user`, or any admin/write scope.

For a fine-grained GitHub token:

- Repository access: public repositories only
- Permissions: read-only metadata access only

Do not add write permissions, admin permissions, workflow permissions, or access to private repositories.

## Run

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## ToDo

- [ ] make tags(colours) abd text clearly visible in dark mode
- [ ] add more search filters
- [ ] filter by repo repos w max open issues at top of filter list
- [ ] add load all pages w pages nums at bottom instead of load more
- [ ] automate searching by refreshing search every 30 mins and send mail or sms if user preferred type of issues come up 
