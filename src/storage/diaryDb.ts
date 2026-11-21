import type { DiaryEntry } from '../types/diary';
import { createUserPhotoDays } from '../engine/seedDays';

const DB_VERSION = 1;
const STORE_NAME = 'days';
const OWNER_USER_KEY = 'atmos_primary_owner_user_id';

function getDbNameForUser(userId?: string | null): string {
  const clean = userId?.trim();
  if (!clean || clean === 'guest') {
    return 'atmos_diary_db_v4';
  }
  return `atmos_diary_user_${clean}`;
}

function isPrimaryOwnerOrGuest(userId?: string | null): boolean {
  const clean = userId?.trim();
  if (!clean || clean === 'guest') return true;
  const existingOwner = localStorage.getItem(OWNER_USER_KEY);
  if (!existingOwner) {
    localStorage.setItem(OWNER_USER_KEY, clean);
    return true;
  }
  return existingOwner === clean;
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
  const dbName = getDbNameForUser(userId);
  const shouldSeedOwnerPhotos = isPrimaryOwnerOrGuest(userId);

  try {
    const currentItems = await readEntriesFromDb(dbName);
    const userMap = new Map<string, DiaryEntry>();

    for (const item of currentItems) {
      if (!item.id.startsWith('seed_day_')) {
        userMap.set(item.id, item);
      }
    }

    // Только для гостя или основного аккаунта владельца подгружаем его 5 фото-дней
    if (shouldSeedOwnerPhotos) {
      const hasUploadedPhotos = Array.from(userMap.keys()).some((k) =>
        k.startsWith('user_photo_day_')
      );
      if (!hasUploadedPhotos) {
        const photoDays = await createUserPhotoDays();
        for (const pDay of photoDays) {
          userMap.set(pDay.id, pDay);
          await saveDay(pDay, userId);
        }
      }
    }

    const userEntries = Array.from(userMap.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );

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
    if (shouldSeedOwnerPhotos) {
      const photoDays = await createUserPhotoDays();
      return photoDays.sort((a, b) => b.indexNumber - a.indexNumber);
    }
    return [];
  }
}

export async function saveDay(
  entry: DiaryEntry,
  userId?: string | null
): Promise<void> {
  const dbName = getDbNameForUser(userId);
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
    // ignore storage errors in restricted modes
  }
}

export async function deleteDay(
  id: string,
  userId?: string | null
): Promise<void> {
  const dbName = getDbNameForUser(userId);
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
