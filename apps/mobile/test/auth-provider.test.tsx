import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';

import { AuthGate, AuthProvider, useAuth } from '../src/auth/auth-provider';

vi.mock('react-native', () => ({
  View: 'div', Text: 'span', ActivityIndicator: 'progress',
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => React.createElement('button', { onClick: onPress }, title),
  StyleSheet: { create: (styles: unknown) => styles },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));

vi.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
    getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: vi.fn(async (key: string) => { values.delete(key); }),
  };
});

let tree: ReactTestRenderer | undefined;
afterEach(async () => {
  if (tree) await act(async () => { tree!.unmount(); });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function Identity() {
  const { session } = useAuth();
  return <span>{session?.user.id}</span>;
}

it('shows a recoverable error, retries without signup, and restores repaired data with the same identity', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('React', React);
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-key');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await SecureStore.setItemAsync('sb-test-auth-token', '{}');
  vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Keychain locked'));

  await act(async () => {
    tree = create(<AuthProvider><AuthGate><Identity /></AuthGate></AuthProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(tree!.root.findByProps({ accessibilityRole: 'alert' }).children.join('')).toContain('Unable to restore');
  expect(tree!.root.findByType('button').children).toEqual(['Retry']);
  expect(await SecureStore.getItemAsync('sb-test-auth-token')).toBe('{}');
  expect(fetch).not.toHaveBeenCalled();

  await act(async () => {
    tree!.root.findByType('button').props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(tree!.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();

  // Simulate recovery from a known backup/transient storage failure, not a new identity.
  await SecureStore.setItemAsync('sb-test-auth-token', JSON.stringify({
    access_token: 'existing-access', refresh_token: 'existing-refresh',
    expires_at: 9999999999, user: { id: 'original-user', is_anonymous: true },
  }));
  await act(async () => {
    tree!.root.findByType('button').props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(tree!.root.findByType(Identity).findByType('span').children).toEqual(['original-user']);
  expect(tree!.root.findAllByType('button')).toHaveLength(0);
  expect(fetch).not.toHaveBeenCalled();
});
