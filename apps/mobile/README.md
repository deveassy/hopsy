# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Anonymous authentication

Copy `.env.example` to `.env` in this directory and set the public Supabase URL
and publishable key for the same project used by the API. Enable anonymous
sign-ins in Supabase Auth. Never put service-role keys or database credentials
in `EXPO_PUBLIC_*` variables; these values are included in the app bundle.

The root `AuthProvider` restores the saved Supabase session before creating an
anonymous user. Concurrent initialization calls share one request. Restore,
network, and storage failures show an error with a Retry button rather than
automatically creating a replacement identity. Existing sessions are refreshed
by the SDK, with auto-refresh paused in the background and resumed when active.
The existing starter screens are shown after authentication; onboarding and
Party screens are not implemented.

Use `useAuth()` from `src/auth/auth-provider.tsx` to access `session`, `loading`,
`error`, and `retry`. The session's `access_token` can be sent as a Bearer token
to the API in future work. The backend remains responsible for verification.

On iOS and Android, tokens are persisted exclusively in Expo SecureStore with
device-only, unlocked Keychain accessibility. Large sessions are split into
small ASCII chunks; updates publish their manifest after writing all chunks.
Failed updates preserve the previous session. Storage corruption/read failures
are surfaced instead of being treated as a missing session. A process crash
during a write may leave unreferenced chunks in secure storage. Do not delete
app data to resolve transient login errors: anonymous identities cannot be
recovered after their refresh token is lost. SecureStore is not a backup, and
uninstall/reinstall behavior differs across platforms.

SecureStore is native-only. Web renders the authentication error state rather
than storing tokens insecurely in localStorage; persistent web authentication
is outside this mobile task. Use an iOS/Android development build after adding
the native module and its config plugin.

From the repository root:

```sh
pnpm --filter @hopsy/mobile test
pnpm --filter @hopsy/mobile typecheck
pnpm --filter @hopsy/mobile lint
pnpm dev:mobile
```

Manual checks on a device/development build:

1. Start with no saved session; confirm loading completes and one anonymous Auth
   user appears in Supabase.
2. Force-close/reopen the app; verify the same user ID and no extra Auth user.
3. Background/foreground the app and confirm session refresh still works.
4. Retry after a network failure, preserving the saved session. Disable anonymous
   sign-in for a clean install to check the error and Retry state.

Automated tests cover bootstrap concurrency, restoring existing identities,
error handling, the real Supabase SDK with mocked signup responses, and a mocked
secure backing store. They do not verify device Keychain/Keystore or live Auth.

References: [Expo SDK 58 SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[Supabase Expo guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native).
