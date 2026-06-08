# Contributing to GSSoC Issue Finder

Thank you for your interest in contributing! We welcome all contributions, whether they are bug fixes, new features, or UI improvements.

## Important Information About the Project

This project is a Next.js 14 application using the App Router, TypeScript, Tailwind CSS, and shadcn/ui. It connects to the official GSSoC projects API and GitHub's search API to filter and display open, unassigned issues for contributors. State management is handled through React hooks and local storage to sync preferences across tabs.

## How to Contribute

To ensure a smooth workflow and avoid multiple people working on the same feature, please follow these steps:

1. **Find or Create an Issue:** Before writing any code, check the issues tab. If the feature or bug you want to work on is not there, please create a new issue.
2. **Get Assigned:** Comment on the issue asking to be assigned. **Do not start working or submit a Pull Request until you have been officially assigned to the issue.**
3. **Fork and Clone:** Once assigned, fork the repository and clone it to your local machine.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
   *(Windows users: use `copy .env.example .env.local`)*
3. Add your GitHub Personal Access Token to `.env.local` to avoid rate limits.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Branch Naming Convention

When you create a new branch for your work, please use the following naming format:

`[type]/issue-[number]`

Valid types include:
* `feat` (for new features)
* `fix` (for bug fixes)
* `refactor` (for code restructuring without changing functionality)
* `ui` (for UI/UX changes)
* `docs` (for documentation updates)

**Example:** If you are assigned to issue #42 to add a new dark mode toggle, your branch should be named `feat/issue-42`.

## Submitting a Pull Request

Once your code is ready and tested locally, push your branch to your fork and open a Pull Request against the main repository. Please reference the issue number in your PR description (e.g., "Fixes #42"). We will review your code and merge it once everything looks good!
