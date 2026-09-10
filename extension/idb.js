// Cozy Engine — local live-wallpaper storage.
//
// Why IndexedDB and not chrome.storage.local: chrome.storage.local has a
// tight quota (a few MB unless "unlimitedStorage" is granted, and even then
// it's designed for small settings blobs, not large binary files). Video
// files in particular can easily be tens of MB. IndexedDB is built for
// exactly this — large binary Blobs, with a much larger browser-managed
// quota — and critically, everything stored here NEVER leaves the browser.
// There is no upload, no server, no sync. This is the "stays on this
// system only" storage layer for the user's own video/gif files.
//
// Loaded as a plain classic script (matches the rest of this extension's
// style — no bundler, no ES modules) and exposes a single global
// `CozyDB` namespace so it doesn't pollute the global scope.

const CozyDB = (() => {
  const DB_NAME = 'CozyLiveWallpapers';
  const DB_VERSION = 1;
  const STORE = 'files';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('addedAt', 'addedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function put(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  return { put, getAll, get, remove, makeId };
})();
