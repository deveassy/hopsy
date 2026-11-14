# Hopsy API

Fastify / TypeScript API backed by Prisma and Supabase PostgreSQL.

## Setup

From the repository root:

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
```

Fill in the database URLs and Supabase project settings using
[`.env.example`](.env.example). `DATABASE_URL` is used at runtime; `DIRECT_URL`
is used by the Prisma CLI. Use the same Supabase project for database and Auth,
and enable anonymous sign-ins in Supabase Auth.

Apply the committed migrations to your development database, then start the API:

```sh
pnpm --filter @hopsy/api db:deploy
pnpm dev:api
```

The default address is `http://localhost:3000`; override it with `HOST` and `PORT`.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Server health check |
| POST | `/parties` | Create a party with `{ "name": "Christmas Crawl" }` |
| GET | `/parties/:id` | Retrieve a party |

Both Party endpoints require `Authorization: Bearer <Supabase access token>`.
The party owner is derived from the verified user. `/health` is public.

## Checks

```sh
pnpm --filter @hopsy/api test
pnpm typecheck:api
pnpm build:api
```
