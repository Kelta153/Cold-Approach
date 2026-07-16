# Outreach Engine

Outreach Engine automates B2B cold outreach end to end — discovering prospects, enriching contact data, drafting personalized messages, and routing them through human approval before anything sends. It's built as a reusable platform: new brands ("Business Lines") are onboarded through configuration, not code.

Operators work from a review queue (email), a reply queue, and an Instagram DM queue, approving sends from the web app or via Telegram. Admins manage business lines, catalogue, templates, targeting, and batch history.

## Stack

- **`apps/api`** — NestJS HTTP API + background workers
- **`apps/web`** — Next.js operator console
- **`packages/`** — shared database schema, types, and the compliance/enrichment logic both apps depend on

## Getting started

```
cp .env.example .env
pnpm install
pnpm --filter @outreach-engine/db db:generate
pnpm --filter @outreach-engine/db db:migrate:dev
pnpm turbo dev
```

See **[docs/project.md](docs/project.md)** for architecture, guardrails, and how each piece fits together.
