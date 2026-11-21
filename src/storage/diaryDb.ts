import type { DiaryEntry } from '../types/diary';
import { createSeedDays } from '../engine/seedDays';

const DB_NAME = 'atmos_diary_db_v3';
const DB_VERSION = 1;
const STORE_NAME = 'days';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
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

export async function loadAllDays(): Promise<DiaryEntry[]> {
  try {
    const db = await openDb();
    const items = await new Promise<DiaryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as DiaryEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    if (items.length === 0) {
      const seeded = await createSeedDays();
      for (const entry of seeded) {
        await saveDay(entry);
      }
      return seeded.sort((a, b) => b.indexNumber - a.indexNumber);
    }

    return items.sort((a, b) => b.indexNumber - a.indexNumber);
  } catch {
    const seeded = await createSeedDays();
    return seeded.sort((a, b) => b.indexNumber - a.indexNumber);
  }
}

export async function saveDay(entry: DiaryEntry): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore storage errors in restricted modes
  }
}

export async function deleteDay(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

export async function resetToSeedDays(): Promise<DiaryEntry[]> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
  const seeded = await createSeedDays();
  for (const entry of seeded) {
    await saveDay(entry);
  }
  return seeded.sort((a, b) => b.indexNumber - a.indexNumber);
}
