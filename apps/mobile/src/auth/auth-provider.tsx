import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Button, StyleSheet, Text, View } from 'react-native';

import { restoreOrSignIn } from './restore-session';
import { getSupabase } from './supabase';

type AuthState = { session: Session | null; loading: boolean; error: string | null };
const AuthContext = createContext<(AuthState & { retry: () => void }) | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ session: null, loading: true, error: null });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    void Promise.resolve().then(() => {
      if (!active) return null;
      const client = getSupabase();
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (!active || event === 'INITIAL_SESSION') return;
        if (session) setState({ session, loading: false, error: null });
        else setState({ session: null, loading: false, error: 'Your session ended. Retry to sign in.' });
      });
      const refresh = (status: string | null | undefined) => {
        if (status === 'active') client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      };
      refresh(AppState.currentState);
      const appState = AppState.addEventListener('change', refresh);
      cleanup = () => {
        subscription.unsubscribe();
        appState.remove();
        client.auth.stopAutoRefresh();
      };
      return restoreOrSignIn(client);
    }).then((session) => {
      if (active && session) setState({ session, loading: false, error: null });
    }).catch(() => {
      if (active) setState({ session: null, loading: false, error: 'Unable to restore or start your session. Check your connection and Supabase configuration, then try again on iOS or Android.' });
    });
    return () => { active = false; cleanup(); };
  }, [attempt]);

  return <AuthContext.Provider value={{ ...state, retry }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

export function AuthGate({ children }: PropsWithChildren) {
  const { loading, error, session, retry } = useAuth();
  if (loading) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Signing in" /><Text>Restoring your session…</Text></View>;
  if (error || !session) return <View style={styles.center}><Text accessibilityRole="alert">{error ?? 'No active session.'}</Text><Button title="Retry" onPress={retry} /></View>;
  return children;
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 } });
