import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DiaryEntry } from '../types/diary';

const DEFAULT_CLERK_PUB_KEY =
  'pk_test_cGxlYXNlZC1vcG9zc3VtLTUzMzcuY2xlcmsuYWNjb3VudHMuZGV2JA';

const STORAGE_KEYS = {
  CLERK_KEY: 'atmos_clerk_pub_key',
  SB_URL: 'atmos_supabase_url',
  SB_ANON: 'atmos_supabase_anon_key',
};

export function getAuthConfig() {
  const clerkKey =
    (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() ||
    localStorage.getItem(STORAGE_KEYS.CLERK_KEY)?.trim() ||
    DEFAULT_CLERK_PUB_KEY;
  const supabaseUrl =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
    localStorage.getItem(STORAGE_KEYS.SB_URL)?.trim() ||
    '';
  const supabaseAnonKey =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
    localStorage.getItem(STORAGE_KEYS.SB_ANON)?.trim() ||
    '';

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
    localStorage.setItem(STORAGE_KEYS.CLERK_KEY, cfg.clerkKey.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.CLERK_KEY);
  }
  if (cfg.supabaseUrl.trim()) {
    localStorage.setItem(STORAGE_KEYS.SB_URL, cfg.supabaseUrl.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.SB_URL);
  }
  if (cfg.supabaseAnonKey.trim()) {
    localStorage.setItem(STORAGE_KEYS.SB_ANON, cfg.supabaseAnonKey.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.SB_ANON);
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
