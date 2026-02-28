/**
 * Lightweight IndexedDB key-value helper.
 *
 * Each store is an object store within a single database.
 * No external dependencies — uses raw IndexedDB API.
 */
import { IDB_DB_NAME, IDB_ALL_STORES } from './constants.js';
import { nativeStringify, nativeParse } from './safe-json.js';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of IDB_ALL_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Check if all required stores exist
      const missing = IDB_ALL_STORES.filter(
        (name) => !db.objectStoreNames.contains(name),
      );
      if (missing.length === 0) {
        resolve(db);
        return;
      }
      // Stores missing — close and reopen with a higher version to trigger onupgradeneeded
      const nextVersion = db.version + 1;
      db.close();
      dbPromise = null;

      const req2 = indexedDB.open(IDB_DB_NAME, nextVersion);
      req2.onupgradeneeded = () => {
        const db2 = req2.result;
        for (const name of IDB_ALL_STORES) {
          if (!db2.objectStoreNames.contains(name)) {
            db2.createObjectStore(name);
          }
        }
      };
      req2.onsuccess = () => resolve(req2.result);
      req2.onerror = () => reject(req2.error);
    };

    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

/** Ensure DB is opened with all required stores. Call once at startup. */
export async function initIDB(): Promise<void> {
  await openDB();
}

/** Get a value by key from a given store. */
export async function idbGet<T = unknown>(store: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Recursively strip values that cannot survive the structured-clone
 * algorithm used by IndexedDB (functions, symbols, etc.).
 *
 * Handles circular references by tracking visited objects.
 */
function sanitizeForClone(value: unknown, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (t === 'function' || t === 'symbol') return undefined;
  if (t === 'bigint') return Number(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return value.toString();
  if (t !== 'object') return String(value);

  // Guard against circular references
  const visited = seen ?? new WeakSet<object>();
  if (visited.has(value as object)) return '[circular]';
  visited.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForClone(v, visited));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const sanitized = sanitizeForClone(v, visited);
    if (sanitized !== undefined) result[k] = sanitized;
  }
  return result;
}

/**
 * Make a value safe for IndexedDB's structured-clone storage.
 *
 * First attempts a cheap JSON round-trip (strips functions, symbols, etc.);
 * if that fails (e.g. circular refs) falls back to a recursive sanitiser.
 */
function ensureCloneable(value: unknown): unknown {
  try {
    return nativeParse(nativeStringify(value));
  } catch {
    return sanitizeForClone(value);
  }
}

/** Set a value by key in a given store. */
export async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  const safe = ensureCloneable(value);
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(safe, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete a key from a given store. */
export async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete the entire IndexedDB database. Closes any open connection first. */
export async function idbDeleteDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch { /* ignore */ }
    dbPromise = null;
  }
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(IDB_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // best-effort
  });
}

/** Get all keys in a given store. */
export async function idbKeys(store: string): Promise<string[]> {
  const db = await openDB();
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}
