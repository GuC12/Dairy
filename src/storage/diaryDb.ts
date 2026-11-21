import type { DiaryEntry } from '../types/diary';
import { createUserPhotoDays } from '../engine/seedDays';

const DB_NAME = 'atmos_diary_db_v3';
const LEGACY_DBS = ['atmos_diary_db_v2', 'atmos_diary_db'];
const DB_VERSION = 1;
const STORE_NAME = 'days';

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

export async function loadAllDays(): Promise<DiaryEntry[]> {
  try {
    const currentItems = await readEntriesFromDb(DB_NAME);

    // Удаляем старые процедурные демо-примеры (seed_day_*)
    for (const item of currentItems) {
      if (item.id.startsWith('seed_day_')) {
        await deleteDay(item.id);
      }
    }

    const userMap = new Map<string, DiaryEntry>();
    for (const item of currentItems) {
      if (!item.id.startsWith('seed_day_')) {
        userMap.set(item.id, item);
      }
    }

    // Проверяем предыдущие версии БД на случай других созданных пользователем записей
    for (const legacyName of LEGACY_DBS) {
      const legacyItems = await readEntriesFromDb(legacyName);
      for (const item of legacyItems) {
        if (!item.id.startsWith('seed_day_') && !userMap.has(item.id)) {
          userMap.set(item.id, item);
          await saveDay(item);
        }
      }
    }

    // Если 5 дней с реальными фотографиями пользователя ещё не добавлены — создаём их
    const hasUploadedPhotos = Array.from(userMap.keys()).some((k) =>
      k.startsWith('user_photo_day_')
    );
    if (!hasUploadedPhotos) {
      const photoDays = await createUserPhotoDays();
      for (const pDay of photoDays) {
        userMap.set(pDay.id, pDay);
        await saveDay(pDay);
      }
    }

    // Сортируем записи по времени создания и нумеруем по порядку
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
        await saveDay(updated);
      }
    }

    return normalized.sort((a, b) => b.indexNumber - a.indexNumber);
  } catch {
    const photoDays = await createUserPhotoDays();
    return photoDays.sort((a, b) => b.indexNumber - a.indexNumber);
  }
}

export async function saveDay(entry: DiaryEntry): Promise<void> {
  try {
    const db = await openNamedDb(DB_NAME);
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

export async function deleteDay(id: string): Promise<void> {
  try {
    const db = await openNamedDb(DB_NAME);
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
