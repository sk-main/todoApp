# Todo App with Claude AI

A full-stack todo app built with Next.js and deployed on Vercel. Integrates Claude AI using structured JSON responses that execute real actions on the UI — complete, delete, add, and categorize todos via natural language. Uses the Anthropic Files API to pass todo context to Claude as a file reference, and Upstash Redis for persistent storage across sessions. Features automatic AI-driven category suggestions and a confirmation safeguard system for destructive actions.

## Claude Features

- **Structured JSON actions** — Claude responds with typed actions (`complete`, `delete`, `add`, `categorize`) that are applied directly to the UI
- **Files API for context** — todos are uploaded as a file on every save; the `file_id` is passed to Claude so it reads the list from the file rather than the prompt
- **Auto-categorization suggestions** — 3 or more related ungrouped items trigger an automatic group suggestion with a confirmation prompt
- **Confirmation safeguards** — destructive operations (delete, delete group) require explicit user confirmation before executing

## Tech Stack

- [Next.js 14](https://nextjs.org) (App Router)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Upstash Redis](https://upstash.com)
- [Anthropic Claude API](https://www.anthropic.com)
- [Vercel](https://vercel.com)

## Getting Started

> This project is designed to be deployed on Vercel with Upstash Redis. Local development without these services will work but todos won't persist.

## Deploying to Vercel

1. Push the repo to GitHub
2. Import the project at [vercel.com](https://vercel.com)
3. Add `ANTHROPIC_API_KEY` as an environment variable
4. Add Upstash Redis via the Vercel Marketplace (Storage tab) — this automatically adds the required `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables
5. Deploy — the app will be live at your Vercel URL

## Testing

```bash
npm test
```

16 tests covering core todo logic and Claude response parsing (add, complete, delete, categorize, ungroup, JSON parsing with fallback).
