# Hopsy 🎄🍻

Hopsy is a social pub crawl game app inspired by the Irish Christmas tradition, 12 Pubs of Christmas.

Create a party, invite your friends, explore pubs, complete challenges, and share your memories.

## Features

- **Party Management** — Create parties and invite friends.
- **Pub Crawl Planning** — Choose pubs and organize your route.
- **Pub Hosts** — Assign a host for each pub.
- **Challenges & Rules** — Set unique rules for each pub.
- **Game Tracking** — Record progress, penalties, and results.
- **Social Sharing** — Share your pub crawl highlights.

## Tech Stack

- **Mobile:** React Native, Expo, TypeScript
- **Backend:** Node.js, Fastify
- **Database:** PostgreSQL, Prisma
- **Authentication:** Supabase Auth
- **Infrastructure:** Supabase, Railway
- **Monorepo:** pnpm Workspaces

## Project Structure

```text
hopsy/
├── apps/
│   ├── mobile/
│   └── api/
├── packages/
│   └── shared/
└── docs/
```

## Backend Development

Use Node.js 24 (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev:api
```

The API listens on `http://localhost:3000`. Override the address with the `HOST`
and `PORT` environment variables (for example, `PORT=3001 pnpm dev:api`).

```sh
curl http://localhost:3000/health
# {"status":"ok"}

pnpm typecheck:api
pnpm build:api
pnpm start:api
```

`GET /health` returns HTTP 200 while the server is running. It does not check
database or external service connectivity.

## Status

🚧 Under active development.

**Target Release:** November 2026

## License

All rights reserved.
