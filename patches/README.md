# Dependency patches

`@supabase__auth-js@2.119.0.patch` handles rejected initial-session notifications
in Supabase Auth JS 2.119.0 by adding the missing await and terminal catch.
Direct session-restoration errors still reach the application's error/Retry UI.

pnpm applies this patch through `patchedDependencies` during installation.
When upgrading the SDK, check the upstream fix and the
[initialization regression tests](../apps/mobile/test/session-persistence.test.ts)
before updating or removing the patch.
