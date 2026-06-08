# GSSoC Issue Finder

Hey everyone! I built this tool to make finding open and unassigned issues for GirlScript Summer of Code (GSSoC) 2026 way easier. It directly connects to the official list of approved GSSoC '26 projects and filters through GitHub to bring you issues that actually need your help.

### Here is what you need to know about how it works:

#### **1) Owner's Issue Tag**

When you are looking through issues, you might see a crown badge next to some of them. That means the **issue was created by the repository owner themselves**. These are usually the best issues to pick up because they are clearly defined and guaranteed to be valid. We push these right to the top of your search results so you do not miss them.

#### **2) Verify Repo Button**

Under each issue card, you will find a Verify repo button. Clicking this button takes you straight to the official GSSoC project page for that specific repository. It is a super quick way to double check the project details and make sure you are contributing to a verified repository before you start writing any code.

#### **3) Whitelist**

There are over 300 approved projects, which is a lot to sift through. If you only want to contribute to specific tech stacks or repositories you already know, you can turn on the Whitelist. Just hop over to the Config page or use the toggle on the Home page, add your favorite repos, and the app will only search inside those specific projects. Turn the toggle off, and you are back to searching everything.

#### **4) Blacklist**

Sometimes you run into a repository that has poorly documented issues, or maybe a specific issue is already unofficially assigned to someone in the comments. You can click the blacklist icon on any issue card to hide that specific issue or the entire repository. Once it is blacklisted, it will not clutter up your future search results. You can manage and toggle your blacklist on or off at any time.

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

Create your local environment file by copying the example:

**Mac/Linux:**

```bash
cp .env.example .env.local
```

**Windows:**

```cmd
copy .env.example .env.local
```

Open `.env.local` and add your GitHub Personal Access Token (PAT).

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

## Suggestions & Contributions

This project is totally open for suggestions, improvements, and contributions! If you have an idea for a new feature, spot a bug, or just want to chat about making the tool better, feel free to reach out.

You can create an [Issue](https://github.com/Kishalll/gssoc-issue-finder/issues) to report any bugs or request a specific feature.

If you have questions, feedback, or want to bounce ideas around before writing code, feel free to create a [Discussion](https://github.com/Kishalll/gssoc-issue-finder/discussions).

Pull requests for any fixes or enhancements are also highly encouraged. Please refer to our [CONTRIBUTING.md](CONTRIBUTING.md) file for setup instructions, branch naming conventions, and contribution guidelines before you begin. Happy coding!
