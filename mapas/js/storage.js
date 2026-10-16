/* Persistência (IndexedDB), versões, importação e exportação de arquivos. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;

  const DB_NAME = 'mapas-territorio';
  const PREFS_KEY = 'mapas-territorio:prefs';
  const LEGACY_INDEX = 'territorio_editor_project_index';
  const LEGACY_PREFIX = 'territorio_editor_project_';
  const MAX_VERSIONS = 30;

  let dbPromise = null;
  let memory = null; // fallback quando o navegador bloqueia o IndexedDB

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB indisponível'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('images', { keyPath: 'id' });
        const v = db.createObjectStore('versions', { keyPath: 'id' });
        v.createIndex('projectId', 'projectId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Banco bloqueado por outra aba'));
    }).catch((err) => {
      console.warn('[Mapas] Usando armazenamento temporário em memória:', err);
      memory = { projects: new Map(), images: new Map(), versions: new Map() };
      return null;
    });
    return dbPromise;
  }

  async function tx(storeName, mode, fn) {
    const db = await openDb();
    if (!db) return fn(memoryStore(storeName));
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, mode);
      const st = t.objectStore(storeName);
      let result;
      Promise.resolve(fn(wrapStore(st))).then((r) => { result = r; }, reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transação abortada'));
    });
  }

  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  function wrapStore(st) {
    return {
      get: (k) => req(st.get(k)),
      put: (v) => req(st.put(v)),
      del: (k) => req(st.delete(k)),
      all: () => req(st.getAll()),
      byIndex: (name, k) => req(st.index(name).getAll(k))
    };
  }

  function memoryStore(name) {
    const m = memory[name];
    return {
      get: async (k) => U.clone(m.get(k)),
      put: async (v) => { m.set(v.id, U.clone(v)); },
      del: async (k) => { m.delete(k); },
      all: async () => Array.from(m.values()).map(U.clone),
      byIndex: async (field, k) => Array.from(m.values()).filter((v) => v[field] === k).map(U.clone)
    };
  }

  /* ---------- Projetos ---------- */

  async function listProjects() {
    const all = await tx('projects', 'readonly', (s) => s.all());
    return all.map((p) => ({ id: p.id, name: p.doc.name, updatedAt: p.doc.updatedAt, thumb: p.thumb || null, objects: p.doc.objects.length }))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  const getProject = (id) => tx('projects', 'readonly', (s) => s.get(id)).then((r) => (r ? r.doc : null));
  const putProject = (doc, thumb) => tx('projects', 'readwrite', (s) => s.put({ id: doc.id, doc: U.clone(stripTransient(doc)), thumb: thumb || null }));

  function stripTransient(doc) {
    const d = Object.assign({}, doc);
    delete d._needsFrame;
    return d;
  }

  async function deleteProject(id) {
    const versions = await tx('versions', 'readonly', (s) => s.byIndex('projectId', id));
    await tx('versions', 'readwrite', async (s) => { for (const v of versions) await s.del(v.id); });
    await tx('projects', 'readwrite', (s) => s.del(id));
    await collectImages();
  }

  /* ---------- Imagens (guardadas uma vez, compartilhadas por versões) ---------- */

  const putImage = (id, dataUrl) => tx('images', 'readwrite', (s) => s.put({ id, dataUrl }));
  const getImage = (id) => tx('images', 'readonly', (s) => s.get(id)).then((r) => (r ? r.dataUrl : null));

  async function collectImages() {
    const [projects, versions, imgs] = await Promise.all([
      tx('projects', 'readonly', (s) => s.all()),
      tx('versions', 'readonly', (s) => s.all()),
      tx('images', 'readonly', (s) => s.all())
    ]);
    const used = new Set();
    projects.forEach((p) => used.add(p.doc.base.imageId));
    versions.forEach((v) => used.add(v.doc.base.imageId));
    await tx('images', 'readwrite', async (s) => { for (const i of imgs) if (!used.has(i.id)) await s.del(i.id); });
  }

  /* ---------- Versões ---------- */

  async function addVersion(doc, label) {
    const v = { id: U.uid('v'), projectId: doc.id, savedAt: new Date().toISOString(), label: label || 'Versão', doc: U.clone(stripTransient(doc)) };
    await tx('versions', 'readwrite', (s) => s.put(v));
    const list = await listVersions(doc.id);
    if (list.length > MAX_VERSIONS) {
      const extra = list.slice(MAX_VERSIONS);
      await tx('versions', 'readwrite', async (s) => { for (const e of extra) await s.del(e.id); });
    }
    return v;
  }

  async function listVersions(projectId) {
    const list = await tx('versions', 'readonly', (s) => s.byIndex('projectId', projectId));
    return list.map((v) => ({ id: v.id, savedAt: v.savedAt, label: v.label, objects: v.doc.objects.length })).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  const getVersion = (id) => tx('versions', 'readonly', (s) => s.get(id)).then((v) => (v ? v.doc : null));

  /* ---------- Preferências leves ---------- */

  function getPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setPrefs(patch) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.assign(getPrefs(), patch))); } catch (e) { /* modo privado */ }
  }

  /* ---------- Migração dos mapas salvos pela versão antiga ---------- */

  async function importLegacyLocalStorage() {
    const prefs = getPrefs();
    if (prefs.legacyImported) return 0;
    let count = 0;
    try {
      const index = JSON.parse(localStorage.getItem(LEGACY_INDEX) || '[]');
      for (const item of index) {
        const raw = localStorage.getItem(LEGACY_PREFIX + item.id);
        if (!raw) continue;
        const { doc, imageDataUrl } = M.migrateLegacy(JSON.parse(raw));
        if (!doc.name) doc.name = item.name || 'Mapa importado';
        if (imageDataUrl) {
          const img = await U.loadImage(imageDataUrl).catch(() => null);
          if (img) {
            const imageId = U.uid('img');
            await putImage(imageId, imageDataUrl);
            Object.assign(doc.base, { imageId, width: img.naturalWidth, height: img.naturalHeight });
          }
        }
        M.fitFrame(doc);
        delete doc._needsFrame;
        await putProject(doc, null);
        count++;
      }
    } catch (e) {
      console.warn('[Mapas] Falha ao importar mapas antigos:', e);
    }
    setPrefs({ legacyImported: true });
    return count;
  }

  /* ---------- Arquivos ---------- */

  async function exportJson(doc) {
    const entry = App.images.get(doc.base.imageId);
    const payload = { format: 'mapas-territorio', version: 6, exportedAt: new Date().toISOString(), doc: stripTransient(doc), image: entry ? entry.dataUrl : null };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    U.downloadBlob(U.safeFileName(doc.name || 'mapa') + '.json', blob);
  }

  // Aceita o backup novo e o JSON da versão antiga do editor.
  function parseProjectFile(text) {
    const data = JSON.parse(text);
    if (data && data.format === 'mapas-territorio' && data.doc) {
      const doc = M.normalize(data.doc);
      return { doc, imageDataUrl: data.image || null, needsFrame: false };
    }
    if (data && (Array.isArray(data.objects) || data.imageData !== undefined)) return M.migrateLegacy(data);
    throw new Error('Arquivo não reconhecido como mapa de território.');
  }

  App.storage = {
    openDb, listProjects, getProject, putProject, deleteProject, putImage, getImage, collectImages,
    addVersion, listVersions, getVersion, getPrefs, setPrefs, importLegacyLocalStorage, exportJson, parseProjectFile,
    isPersistent: () => !memory
  };
})();
