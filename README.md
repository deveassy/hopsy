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
automatically create a membership. These are application tables; Supabase Auth users are synchronized by verified
UUID into `User` without changing the database constraints.

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
with `pnpm dev:api`. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the same
project as the database (a legacy anon key also works). No service-role key is
needed. Enable anonymous sign-ins in the Supabase Auth dashboard. On the client,
call `supabase.auth.signInAnonymously()` and send the session's `access_token`:

```sh
curl -i http://localhost:3000/parties \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Christmas Crawl"}'
curl -i http://localhost:3000/parties/<party-uuid> \
  -H "Authorization: Bearer $ACCESS_TOKEN"
pnpm --filter @hopsy/api test
```

Both Party routes require a valid Supabase user access token. The API verifies it
with the project's Auth server using `auth.getUser(token)`; it does not trust
client-supplied user IDs or unverified JWT payloads. Anonymous Auth users are real
Supabase users with the `authenticated` role, distinct from the public anon API
key. Permanent users are supported too. No API session or token refresh is stored;
the client manages its session. `/health` remains public.

After authentication and request validation, the API upserts the Prisma `User`
with the verified Supabase UUID. A new row receives the initial name `Anonymous`;
existing names are preserved. `POST /parties` accepts only `name`, derives
`ownerId` from that UUID, and returns 201. Sending `ownerId` is rejected with 400.
`GET /parties/:id` returns 200 or 404; any authenticated user can retrieve a party
by ID at this stage (no membership or owner-only access rules are added).
Responses contain `id`, `name`, `ownerId`, `createdAt`, and `updatedAt`.

Names must contain non-whitespace text and be at most 100 characters; surrounding
whitespace is trimmed. Party IDs must be UUIDs. Invalid input returns 400;
missing, malformed, or rejected credentials return 401. Unexpected Auth service
or database failures return a generic 500 without sensitive details. Creation
does not add memberships. Tests exercise Fastify requests with mocked Prisma and
Auth verification, plus the real Supabase SDK against mocked Auth HTTP responses.
Live Supabase authentication and persistence are not verified by these tests.

Reference: [Supabase getUser verification](https://supabase.com/docs/reference/javascript/auth-getuser).

## Status

🚧 Under active development.

**Target Release:** November 2026

## License

All rights reserved.
