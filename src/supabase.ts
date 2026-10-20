import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Keep the login fresh only while the app is open (Supabase's recommended setup for React Native).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export type Role = 'owner' | 'manager' | 'technician';

/** Turn a Supabase/Postgres error into something a person can act on. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first: open the link we emailed you, then sign in.';
  if (/User already registered/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
  if (/Password should be/i.test(msg)) return 'Use a password of at least 6 characters.';
  if (/rate limit/i.test(msg)) return 'Too many emails were sent recently. Wait a few minutes and try again.';
  if (/No crew found/i.test(msg)) return 'No crew found with that code. Check the code with your fleet owner.';
  if (/Network request failed|fetch/i.test(msg)) return 'No internet connection. Try again when you are online.';
  return msg;
}
