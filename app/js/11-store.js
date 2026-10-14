/* ================= Storage on the device (IndexedDB) =================
   modules:  one record per installed module { id, json, installedAt, usedAt, bytes }
   media:    the module's pictures/audio/video as Blobs, key "<module id>\n<path>"
   progress: one record per module (the same shape as progress.json in a shared module)
   kv:       app-wide things: settings, streak, XP, an exam in progress */
const DB_NAME = 'shell', DB_VERSION = 1;
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, DB_VERSION);
    rq.onupgradeneeded = () => {
      const d = rq.result;
      if (!d.objectStoreNames.contains('modules')) d.createObjectStore('modules', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media');
      if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress', { keyPath: 'module' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store); let out;
    const r = fn(s); if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  });
}
const idb = {
  get: (store, key) => tx(store, 'readonly', s => s.get(key)),
  put: (store, val, key) => tx(store, 'readwrite', s => (key === undefined ? s.put(val) : s.put(val, key))),
  del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
  all: store => tx(store, 'readonly', s => s.getAll()),
  delPrefix: (store, prefix) => tx(store, 'readwrite', s => s.delete(IDBKeyRange.bound(prefix, prefix + '￿'))),
  keysPrefix: (store, prefix) => tx(store, 'readonly', s => s.getAllKeys(IDBKeyRange.bound(prefix, prefix + '￿')))
};
/* Ask the browser not to clear our data when space runs low */
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

/* App-wide state, kept in memory and saved on change */
const APP_DEFAULT = { settings: { lang: 'auto', theme: 'auto', sound: true, motion: true }, xp: 0, days: {}, streak: { n: 0, last: null }, order: [] };
let APP = JSON.parse(JSON.stringify(APP_DEFAULT));
async function loadApp() { const v = await idb.get('kv', 'app'); if (v) APP = { ...APP, ...v, settings: { ...APP.settings, ...(v.settings || {}) } }; }
let appSaveTimer = 0;
function saveApp() { clearTimeout(appSaveTimer); appSaveTimer = setTimeout(() => idb.put('kv', APP, 'app'), 150); }
