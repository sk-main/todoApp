# Todo App with Claude AI

A full-stack todo app built with Next.js and deployed on Vercel. Integrates Claude AI using structured JSON responses that execute real actions on the UI — complete, delete, add, and categorize todos via natural language. Uses the Anthropic Files API to pass todo context to Claude as a file reference, and Upstash Redis for persistent storage across sessions. Features automatic AI-driven category suggestions and a confirmation safeguard system for destructive actions.

## Live Demo

[https://todo-app-wheat-seven-79.vercel.app](https://todo-app-wheat-seven-79.vercel.app)

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

1. Clone the repo:
   ```bash
   git clone https://github.com/sk-main/todoApp.git
   cd todoApp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` with your credentials:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   KV_REST_API_URL=your_upstash_redis_url
   KV_REST_API_TOKEN=your_upstash_redis_token
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Testing

```bash
npm test
```

16 tests covering core todo logic and Claude response parsing (add, complete, delete, categorize, ungroup, JSON parsing with fallback).
