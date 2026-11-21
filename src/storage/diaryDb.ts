import type { DiaryEntry } from '../types/diary';

const DB_VERSION = 1;
const STORE_NAME = 'days';
const RESET_FLAG_KEY = 'yourdiary_clean_reset_v1';

function cleanupOldDatabasesOnce(): void {
  try {
    if (localStorage.getItem(RESET_FLAG_KEY)) return;
    const oldDbs = [
      'atmos_diary_db',
      'atmos_diary_db_v2',
      'atmos_diary_db_v3',
      'atmos_diary_db_v4',
    ];
    for (const name of oldDbs) {
      indexedDB.deleteDatabase(name);
    }
    localStorage.removeItem('atmos_primary_owner_user_id');
    localStorage.setItem(RESET_FLAG_KEY, 'true');
  } catch {
    // ignore
  }
}

function getDbNameForUser(userId?: string | null): string | null {
  const clean = userId?.trim();
  if (!clean || clean === 'guest') {
    return null;
  }
  return `yourdiary_v1_user_${clean}`;
}

function openNamedDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readEntriesFromDb(name: string): Promise<DiaryEntry[]> {
  try {
    const db = await openNamedDb(name);
    const items = await new Promise<DiaryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as DiaryEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items;
  } catch {
    return [];
  }
}

export async function loadAllDays(userId?: string | null): Promise<DiaryEntry[]> {
  cleanupOldDatabasesOnce();
  const dbName = getDbNameForUser(userId);
  if (!dbName) return [];

  try {
    const currentItems = await readEntriesFromDb(dbName);
    const userEntries = currentItems
      .filter(
        (item) =>
          !item.id.startsWith('seed_day_') &&
          !item.id.startsWith('user_photo_day_')
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const normalized: DiaryEntry[] = [];
    for (let i = 0; i < userEntries.length; i++) {
      const updated = {
        ...userEntries[i],
        indexNumber: i + 1,
      };
      normalized.push(updated);
      if (userEntries[i].indexNumber !== i + 1) {
        await saveDay(updated, userId);
      }
    }

    return normalized.sort((a, b) => b.indexNumber - a.indexNumber);
  } catch {
    return [];
  }
}

export async function saveDay(
  entry: DiaryEntry,
  userId?: string | null
): Promise<void> {
  const dbName = getDbNameForUser(userId);
  if (!dbName) return;
  try {
    const db = await openNamedDb(dbName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function deleteDay(
  id: string,
  userId?: string | null
): Promise<void> {
  const dbName = getDbNameForUser(userId);
  if (!dbName) return;
  try {
    const db = await openNamedDb(dbName);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
