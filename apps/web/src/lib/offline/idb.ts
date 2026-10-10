/**
 * One small IndexedDB database for everything the app keeps for offline use:
 *   outbox      queued writes, in order (auto-increment key)
 *   blobs       pictures and recordings waiting to upload, keyed by asset id
 *   meta        small key/value facts (cached note ids, recently opened notes, flags)
 *   queryCache  the persisted TanStack Query cache
 * Note documents live in y-indexeddb's own databases, one per note.
 */
export const DB_NAME = "scraps-offline";
export const DB_VERSION = 1;

export type StoreName = "outbox" | "blobs" | "meta" | "queryCache";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });
}

export class OfflineDb {
  private opening: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory | undefined = typeof indexedDB === "undefined"
      ? undefined
      : indexedDB,
    private readonly name = DB_NAME,
  ) {}

  /** False in environments with no IndexedDB (private windows in old browsers, server render). */
  get available(): boolean {
    return this.factory !== undefined;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new Error("IndexedDB is not available"));
    this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = this.factory!.open(this.name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("queryCache")) db.createObjectStore("queryCache");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });
    return this.opening;
  }

  async get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.open();
    return request<T | undefined>(db.transaction(store).objectStore(store).get(key));
  }

  async put(store: StoreName, value: unknown, key?: IDBValidKey): Promise<IDBValidKey> {
    const db = await this.open();
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value, key);
    const result = await request(req);
    await transactionDone(tx);
    return result;
  }

  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    await transactionDone(tx);
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.open();
    return request<T[]>(db.transaction(store).objectStore(store).getAll());
  }

  async keys(store: StoreName): Promise<IDBValidKey[]> {
    const db = await this.open();
    return request(db.transaction(store).objectStore(store).getAllKeys());
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    await transactionDone(tx);
  }

  close() {
    void this.opening?.then((db) => db.close());
    this.opening = null;
  }
}

/** The app-wide database. */
export const offlineDb = new OfflineDb();
