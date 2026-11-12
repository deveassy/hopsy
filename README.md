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

## Database Setup

Prisma uses Supabase PostgreSQL. Run commands from the repository root:

```sh
cp apps/api/.env.example apps/api/.env
# Replace placeholders with connection strings from Supabase's Connect panel.
pnpm --filter @hopsy/api db:validate
pnpm --filter @hopsy/api db:generate
pnpm typecheck:api
pnpm build:api
```

`DATABASE_URL` is the runtime transaction pooler connection (port 6543).
`DIRECT_URL` is the Prisma CLI direct connection (port 5432); use the session
pooler connection from Supabase if your network cannot reach the IPv6 direct
host. Percent-encode special characters in passwords. `.env` stays untracked.
The API package loads its `.env` via dotenv when commands run from its directory.

Schema validation, client generation, type checks, and builds work without real
database credentials. Build and typecheck generate the ignored client into
`apps/api/src/generated/prisma`; import the shared `prisma` instance from
`apps/api/src/lib/prisma.ts` for future database code. Importing it requires
`DATABASE_URL`, but connections are opened only when queries run. Call
`prisma.$disconnect()` when shutting down a process that uses it.

Initial models are `User` (name and timestamps), `Party` (name and owner), and
`PartyMember` (user/party membership and join time). A composite primary key
prevents duplicate memberships. Party owners must be reassigned before deleting
their user; deleting a party or user removes its memberships. Ownership does not
automatically create a membership. These are application tables with no Supabase
Auth integration yet.

No migration has been applied. Once a development database and a separate shadow
database are available, create and review the initial migration with
`pnpm --filter @hopsy/api db:migrate --name init`. Prisma Migrate needs permission
to create a shadow database, or an explicit `shadowDatabaseUrl` in
`prisma.config.ts` pointing to a separate disposable database. Never use the
application database as the shadow database. Commit generated migrations before
using `pnpm --filter @hopsy/api db:deploy` for deployment.

References: [Prisma PostgreSQL setup](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
and [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma).

## Party API

With the database schema migrated and `apps/api/.env` configured, start the API
with `pnpm dev:api`. An existing `User` row is required to create a party. Use its
real UUID as `ownerId`; this API does not create users or authenticate callers.
The caller-supplied owner ID is not proof of identity or ownership.

```sh
curl -i http://localhost:3000/parties \
  -H 'Content-Type: application/json' \
  -d '{"name":"Christmas Crawl","ownerId":"<existing-user-uuid>"}'
curl -i http://localhost:3000/parties/<party-uuid>
pnpm --filter @hopsy/api test
```

`POST /parties` returns 201 and the saved party; `GET /parties/:id` returns 200
and the party, or 404 if missing. Both return `id`, `name`, `ownerId`, `createdAt`,
and `updatedAt`. Names must contain non-whitespace text and be at most 100
characters; surrounding whitespace is trimmed. Owner and party IDs must be UUIDs.
Invalid input or a nonexistent owner returns 400. Unexpected database failures
return a generic 500 response without database details. Creation does not add a
membership. Tests use Fastify injection with mocked Prisma calls and do not
require or verify a live Supabase connection.

## Status

🚧 Under active development.

**Target Release:** November 2026

## License

All rights reserved.
