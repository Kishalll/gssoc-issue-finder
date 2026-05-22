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
- Optional: GitHub personal access token for higher GitHub API rate limits

## Setup

Install dependencies:

```bash
npm install
```

Create or update `.env.local`:

```bash
NEXT_PUBLIC_GITHUB_PAT=
```

The token is optional. If you add one, it is only used by the fallback GitHub API request.

For public repositories, use a fine-grained GitHub token with:

- Repository access: public repositories only
- Permissions: read-only metadata access

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

- [ ] make tags abd text clearly visible in dark mode
- [ ] add more search filters
- [ ] filter by repo repos w max open issues at top of filter list
- [ ] add load all pages w pages nums at bottom instead of load more

