import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DiaryEntry } from '../types/diary';

const DEFAULT_CLERK_PUB_KEY =
  'pk_test_cGxlYXNlZC1vcG9zc3VtLTUzMzcuY2xlcmsuYWNjb3VudHMuZGV2JA';
const DEFAULT_SUPABASE_URL = 'https://vzpmqffzvmxzwotxcurb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6cG1xZmZ6dm14endvdHhjdXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNzUwOTIsImV4cCI6MjExMDg1MTA5Mn0.OPxZLQh6nYKtBSJ3nMZGwEdTRHlcoRhnJC633d4Uc5A';

const STORAGE_KEYS = {
  CLERK_KEY: 'atmos_clerk_pub_key',
  SB_URL: 'atmos_supabase_url',
  SB_ANON: 'atmos_supabase_anon_key',
};

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getAuthConfig() {
  const clerkKey =
    (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    safeStorageGet(STORAGE_KEYS.CLERK_KEY)?.trim() ||
    DEFAULT_CLERK_PUB_KEY;
  const supabaseUrl =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
    safeStorageGet(STORAGE_KEYS.SB_URL)?.trim() ||
    DEFAULT_SUPABASE_URL;
  const supabaseAnonKey =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    safeStorageGet(STORAGE_KEYS.SB_ANON)?.trim() ||
    DEFAULT_SUPABASE_ANON_KEY;

  return {
    clerkKey,
    supabaseUrl,
    supabaseAnonKey,
    hasClerk: clerkKey.startsWith('pk_'),
    hasSupabase:
      supabaseUrl.startsWith('http') && supabaseAnonKey.length > 15,
  };
}

export function saveRuntimeAuthConfig(cfg: {
  clerkKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}) {
  if (cfg.clerkKey.trim()) {
    safeStorageSet(STORAGE_KEYS.CLERK_KEY, cfg.clerkKey.trim());
  } else {
    safeStorageRemove(STORAGE_KEYS.CLERK_KEY);
  }
  if (cfg.supabaseUrl.trim()) {
    safeStorageSet(STORAGE_KEYS.SB_URL, cfg.supabaseUrl.trim());
  } else {
    safeStorageRemove(STORAGE_KEYS.SB_URL);
  }
  if (cfg.supabaseAnonKey.trim()) {
    safeStorageSet(STORAGE_KEYS.SB_ANON, cfg.supabaseAnonKey.trim());
  } else {
    safeStorageRemove(STORAGE_KEYS.SB_ANON);
  }
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const { supabaseUrl, supabaseAnonKey, hasSupabase } = getAuthConfig();
  if (!hasSupabase) return null;
  try {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
    return cachedClient;
  } catch {
    return null;
  }
}

export interface AppUserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  provider: 'clerk' | 'supabase-local';
}

export async function syncUserProfileToSupabase(
  user: AppUserProfile
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  try {
    const { error } = await sb.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        avatar_url: user.avatarUrl ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function fetchCloudDays(
  userId: string
): Promise<DiaryEntry[] | null> {
  const sb = getSupabaseClient();
  if (!sb || !userId) return null;
  try {
    const { data, error } = await sb
      .from('diary_entries')
      .select('entry_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return null;
    return data
      .map((row: { entry_data?: DiaryEntry }) => row.entry_data)
      .filter((item): item is DiaryEntry => Boolean(item && item.id));
  } catch {
    return null;
  }
}

export async function upsertCloudDay(
  userId: string,
  entry: DiaryEntry
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb || !userId) return false;
  try {
    const { error } = await sb.from('diary_entries').upsert(
      {
        id: `${userId}_${entry.id}`,
        entry_id: entry.id,
        user_id: userId,
        folder_name: entry.analysis.folderName,
        entry_data: entry,
        created_at: entry.createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function deleteCloudDay(
  userId: string,
  entryId: string
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb || !userId) return false;
  try {
    const { error } = await sb
      .from('diary_entries')
      .delete()
      .eq('id', `${userId}_${entryId}`);
    return !error;
  } catch {
    return false;
  }
}
