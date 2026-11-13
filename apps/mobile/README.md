# Hopsy Mobile

Expo / React Native app using Expo Router and TypeScript.

## Setup

From the repository root:

```sh
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
`apps/mobile/.env`, and enable anonymous sign-ins in Supabase Auth. Use the same
Supabase project as the API. Only public client configuration belongs here;
never include service-role keys or database credentials.

```sh
pnpm dev:mobile
```

Use an iOS or Android development build with the native dependencies installed.
Web authentication is not configured.

## Authentication

The app restores an existing session or signs in anonymously when none exists.
Sessions are stored in Expo SecureStore. Restoration failures show an error and
Retry without automatically resetting the session or creating a new user.
Lost anonymous credentials cannot currently be recovered by the app.

`useAuth()` in `src/auth/auth-provider.tsx` exposes the session, loading state,
error, and retry action. The SDK requires a small [initialization patch](../../patches/README.md).

## Checks

```sh
pnpm --filter @hopsy/mobile test
pnpm --filter @hopsy/mobile typecheck
pnpm --filter @hopsy/mobile lint
```
