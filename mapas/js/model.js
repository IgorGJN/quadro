/* Modelo do documento: tipos, valores padrão, histórico e operações de edição. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;

  const TYPES = {
    road: { label: 'Rua', plural: 'Ruas', icon: 'road' },
    area: { label: 'Área', plural: 'Áreas', icon: 'area' },
    text: { label: 'Texto', plural: 'Textos', icon: 'text' },
    marker: { label: 'Ponto', plural: 'Pontos', icon: 'marker' },
    focus: { label: 'Foco', plural: 'Focos', icon: 'focus' },
    compass: { label: 'Norte', plural: 'Norte', icon: 'compass' },
    legend: { label: 'Legenda', plural: 'Legendas', icon: 'legend' }
  };

  // Ordem de desenho, de baixo para cima. Ruas cobrem áreas; o foco cobre ruas;
  // anotações ficam sempre legíveis por cima de tudo.
  const GROUPS = [
    { id: 'notes', label: 'Anotações', types: ['text', 'marker', 'compass', 'legend'] },
    { id: 'focus', label: 'Foco', types: ['focus'] },
    { id: 'roads', label: 'Ruas', types: ['road'] },
    { id: 'areas', label: 'Áreas', types: ['area'] }
  ];
  const groupOf = (type) => GROUPS.find((g) => g.types.includes(type)).id;
  const DRAW_ORDER = ['areas', 'roads', 'focus', 'notes'];

  const ICONS = [
    { id: 'dot', glyph: '', label: 'Ponto' },
    { id: 'star', glyph: '★', label: 'Referência' },
    { id: 'home', glyph: '⌂', label: 'Casa' },
    { id: 'building', glyph: '■', label: 'Prédio' },
    { id: 'church', glyph: '✝', label: 'Igreja' },
    { id: 'health', glyph: '✚', label: 'Saúde' },
    { id: 'school', glyph: 'E', label: 'Escola' },
    { id: 'shop', glyph: '$', label: 'Comércio' },
    { id: 'park', glyph: '♣', label: 'Praça' },
    { id: 'bus', glyph: 'B', label: 'Ônibus' },
    { id: 'flag', glyph: '⚑', label: 'Marco' },
    { id: 'start', glyph: '▶', label: 'Início' },
    { id: 'warn', glyph: '!', label: 'Atenção' },
    { id: 'no', glyph: '✕', label: 'Não visitar' },
    { id: 'info', glyph: 'i', label: 'Informação' },
    { id: 'pin1', glyph: '1', label: 'Número 1' },
    { id: 'pin2', glyph: '2', label: 'Número 2' },
    { id: 'pin3', glyph: '3', label: 'Número 3' }
  ];
  const iconById = (id) => ICONS.find((i) => i.id === id) || ICONS[0];

  const FRAMES = {
    card: { label: 'Cartão de território · 14 × 5,8 cm', w: 14, h: 5.8 },
    card15: { label: 'Cartão 15 × 10 cm', w: 15, h: 10 },
    a5: { label: 'A5 paisagem · 21 × 14,8 cm', w: 21, h: 14.8 },
    a4l: { label: 'A4 paisagem · 29,7 × 21 cm', w: 29.7, h: 21 },
    a4p: { label: 'A4 retrato · 21 × 29,7 cm', w: 21, h: 29.7 },
    square: { label: 'Quadrado · 10 × 10 cm', w: 10, h: 10 }
  };

  const DEFAULTS = {
    road: { color: '#2f5fb3', width: 16, casing: 3, casingColor: '#ffffff', rounded: true, smooth: false, dashed: false, name: '', showLabel: true, labelSize: 22, labelColor: '#16203a' },
    area: { name: '', fill: '#facc15', fillOpacity: 0.25, stroke: '#16203a', strokeWidth: 5, dashed: false, smooth: false, labelSize: 40, labelColor: '#16203a' },
    text: { text: 'Texto', color: '#16203a', size: 28, bold: true, halo: '#ffffff', haloWidth: 6, rotation: 0 },
    marker: { icon: 'star', style: 'pin', color: '#dc2626', size: 38, name: '', labelSize: 22 },
    focus: { shape: 'rect', maskColor: '#ffffff', maskOpacity: 0.6, stroke: '#16203a', strokeWidth: 5, dashed: false, name: '', labelSize: 26 },
    compass: { color: '#16203a', size: 90, rotation: 0 },
    legend: { title: 'Legenda', auto: true, text: '', size: 20, color: '#16203a', bg: '#ffffff', bgOpacity: 0.92, border: '#16203a', borderWidth: 2 }
  };
  // Medidas proporcionais ao tamanho do cartão: novos itens nascem com o mesmo
  // tamanho visual, seja o mapa uma captura pequena ou uma imagem enorme.
  const SIZE_KEYS = ['width', 'casing', 'labelSize', 'strokeWidth', 'size', 'haloWidth', 'borderWidth'];
  const CONTENT_KEYS = ['name', 'text', 'title', 'rotation', 'x', 'y', 'w', 'h', 'points', 'visible', 'locked', 'id', 'type'];
  const MIN_POINTS = { road: 2, area: 3 };

  const store = {
    doc: null,
    sel: { id: null, node: null },
    stylePrefs: {},
    onPrefsChange: null,
    past: [],
    future: [],
    listeners: [],
    lastKey: null,
    lastAt: 0
  };

  /* ---------- Documento ---------- */

  function newDoc(name) {
    const now = new Date().toISOString();
    return {
      version: 6,
      id: U.uid('map'),
      name: name || '',
      createdAt: now,
      updatedAt: now,
      frame: { x: 0, y: 0, w: 1400, h: 580, preset: 'card' },
      base: { imageId: null, width: 0, height: 0, visible: true, opacity: 1, grayscale: false, attribution: '' },
      nodes: {},
      objects: [],
      settings: { snap: true, autoCross: true, showNodes: true, dimOutside: true }
    };
  }

  function normalize(doc) {
    const d = Object.assign(newDoc(), doc);
    d.frame = Object.assign(newDoc().frame, doc.frame);
    d.base = Object.assign(newDoc().base, doc.base);
    d.settings = Object.assign(newDoc().settings, doc.settings);
    d.nodes = Object.assign({}, doc.nodes);
    d.objects = (doc.objects || []).filter((o) => TYPES[o.type]).map((o) => Object.assign({ visible: true, locked: false }, DEFAULTS[o.type], o));
    d.version = 6;
    return d;
  }

  function frameRatio(doc) {
    const f = FRAMES[(doc || store.doc).frame.preset] || FRAMES.card;
    return f.w / f.h;
  }

  // Ajusta o cartão ao mapa base (preenchendo-o) ou, sem mapa, ao conteúdo.
  function fitFrame(doc, presetId) {
    if (presetId) doc.frame.preset = presetId;
    const r = frameRatio(doc);
    let b, contain = false;
    if (doc.base.imageId && doc.base.width) {
      b = { x: 0, y: 0, w: doc.base.width, h: doc.base.height };
    } else {
      const pts = Object.values(doc.nodes);
      doc.objects.forEach((o) => {
        if (o.points) return;
        pts.push({ x: o.x, y: o.y });
        if (o.w) pts.push({ x: o.x + o.w, y: o.y + o.h });
      });
      if (!pts.length) b = { x: 0, y: 0, w: 1400, h: 580 };
      else {
        b = U.bounds(pts);
        const pad = Math.max(b.w, b.h, 200) * 0.12;
        b = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
      }
      contain = true;
    }
    const w = contain ? Math.max(b.w, b.h * r) : Math.min(b.w, b.h * r);
    const h = w / r;
    doc.frame.x = b.x + (b.w - w) / 2;
    doc.frame.y = b.y + (b.h - h) / 2;
    doc.frame.w = w;
    doc.frame.h = h;
  }

  /* ---------- Migração do formato antigo (v5) ---------- */

  const LEGACY_ICONS = { '●': 'dot', '✚': 'health', '✝': 'church', '★': 'star', '■': 'building', '⚑': 'flag', '⌂': 'home', 'ⓘ': 'info' };

  function migrateLegacy(p) {
    const doc = newDoc(p.projectName || '');
    if (p.savedAt) doc.updatedAt = p.savedAt;
    (p.nodes || []).forEach((n) => { if (n && n.id) doc.nodes[n.id] = { x: +n.x || 0, y: +n.y || 0 }; });

    const pointIds = (pts) => (pts || []).map((pt) => {
      if (pt.nodeId && doc.nodes[pt.nodeId]) return pt.nodeId;
      const id = U.uid('n');
      doc.nodes[id] = { x: +pt.x || 0, y: +pt.y || 0 };
      return id;
    });

    (p.objects || []).forEach((o) => {
      const common = { id: o.id || U.uid('o'), visible: o.visible !== false, locked: !!o.locked };
      let out = null;
      if (o.type === 'road') {
        out = { type: 'road', points: pointIds(o.points), color: o.color || '#2563eb', width: o.size || 8, casing: o.borderWidth || 0, casingColor: o.borderColor || '#ffffff', rounded: o.rounded !== false, smooth: !!o.smooth, name: o.name || '', showLabel: false };
      } else if (o.type === 'area') {
        out = { type: 'area', points: pointIds(o.points), name: o.name || '', fill: o.color || '#facc15', fillOpacity: o.opacity ?? 0.25, stroke: o.borderColor || '#111827', strokeWidth: o.borderWidth || 3, smooth: !!o.smooth, labelSize: o.size || 16, labelColor: o.borderColor || '#111827' };
      } else if (o.type === 'text') {
        out = { type: 'text', x: o.x || 0, y: o.y || 0, text: o.name || 'Texto', color: o.color || '#111827', size: o.size || 18, halo: o.borderColor || '#ffffff', haloWidth: o.borderWidth ?? 4, rotation: o.rotation || 0 };
      } else if (o.type === 'point') {
        out = { type: 'marker', x: o.x || 0, y: o.y || 0, icon: LEGACY_ICONS[o.icon] || 'dot', style: 'symbol', color: o.color || '#dc2626', size: o.size || 24, name: o.name || '', labelSize: 14 };
      } else if (o.type === 'focus') {
        const x = Math.min(o.x || 0, (o.x || 0) + (o.w || 0)), y = Math.min(o.y || 0, (o.y || 0) + (o.h || 0));
        out = { type: 'focus', x, y, w: Math.abs(o.w || 0), h: Math.abs(o.h || 0), shape: o.shape === 'rect' || !o.shape ? 'rect' : 'ellipse', maskColor: o.color || '#ffffff', maskOpacity: o.opacity ?? 0.55, stroke: o.borderColor || '#111827', strokeWidth: o.borderWidth ?? 4, name: o.name === 'Área de foco' ? '' : o.name || '', labelSize: o.size || 16 };
      } else if (o.type === 'compass') {
        out = { type: 'compass', x: o.x || 0, y: o.y || 0, color: o.color || '#111827', size: o.size || 60, rotation: o.rotation || 0 };
      } else if (o.type === 'legend') {
        const lines = String(o.name || 'Legenda').split('\n');
        out = { type: 'legend', x: o.x || 0, y: o.y || 0, auto: false, title: lines[0] || 'Legenda', text: lines.slice(1).join('\n'), size: o.size || 16, color: o.color || '#111827', bg: o.backgroundColor || '#ffffff', bgOpacity: 1 - (o.opacity ?? 0.1), border: o.borderColor || '#111827', borderWidth: o.borderWidth ?? 2 };
      }
      if (out) doc.objects.push(Object.assign({}, DEFAULTS[out.type], common, out));
    });

    doc.base.visible = !(p.settings && p.settings.mapVisible === false);
    doc.settings.snap = !(p.settings && p.settings.snapEnabled === false);
    doc.settings.autoCross = false;
    doc._needsFrame = true;
    cleanupNodes(doc);
    return { doc: normalize(doc), imageDataUrl: p.imageData || null, needsFrame: true };
  }

  /* ---------- Eventos e histórico ---------- */

  function on(fn) { store.listeners.push(fn); }
  function emit(kind) { store.listeners.forEach((fn) => fn(kind)); }

  function changed() {
    store.doc.updatedAt = new Date().toISOString();
    emit('doc');
  }

  function snapshot() {
    const d = store.doc;
    return U.clone({ name: d.name, frame: d.frame, base: d.base, nodes: d.nodes, objects: d.objects, settings: d.settings, sel: store.sel });
  }

  function restore(s) {
    const d = store.doc;
    d.name = s.name; d.frame = s.frame; d.base = s.base; d.nodes = s.nodes; d.objects = s.objects; d.settings = s.settings;
    store.sel = get(s.sel.id) ? s.sel : { id: null, node: null };
  }

  // Registra o estado atual antes de uma alteração. Alterações seguidas com a
  // mesma chave (ex.: arrastar um controle deslizante) viram um único passo.
  function checkpoint(key) {
    const now = Date.now();
    if (key && key === store.lastKey && now - store.lastAt < 1200) { store.lastAt = now; return; }
    store.past.push(snapshot());
    if (store.past.length > 150) store.past.shift();
    store.future = [];
    store.lastKey = key || null;
    store.lastAt = now;
  }

  function breakMerge() { store.lastKey = null; }
  function dropLastCheckpoint() { store.past.pop(); store.lastKey = null; }

  function undo() {
    if (!store.past.length) return false;
    store.future.push(snapshot());
    restore(store.past.pop());
    store.lastKey = null;
    changed();
    emit('select');
    return true;
  }

  function redo() {
    if (!store.future.length) return false;
    store.past.push(snapshot());
    restore(store.future.pop());
    store.lastKey = null;
    changed();
    emit('select');
    return true;
  }

  function setDoc(doc) {
    store.doc = doc;
    store.sel = { id: null, node: null };
    store.past = [];
    store.future = [];
    store.lastKey = null;
    emit('load');
  }

  /* ---------- Consultas ---------- */

  const get = (id) => (id && store.doc ? store.doc.objects.find((o) => o.id === id) || null : null);
  const node = (id) => store.doc.nodes[id] || null;
  const points = (obj) => (obj.points || []).map((id) => store.doc.nodes[id]).filter(Boolean);
  const selected = () => get(store.sel.id);
  const isPath = (obj) => !!obj && (obj.type === 'road' || obj.type === 'area');

  function nodeUsage(nodeId) {
    let n = 0;
    store.doc.objects.forEach((o) => { if (o.points && o.points.includes(nodeId)) n++; });
    return n;
  }

  function sizeFactor() { return store.doc.frame.w / 1400; }

  function select(id, nodeId) {
    const prev = store.sel;
    store.sel = { id: id || null, node: nodeId || null };
    if (prev.id !== store.sel.id || prev.node !== store.sel.node) {
      breakMerge();
      emit('select');
    }
  }

  /* ---------- Estilo lembrado por tipo ---------- */

  function styleFor(type) {
    const k = sizeFactor();
    const prefs = store.stylePrefs[type] || {};
    const out = {};
    Object.keys(DEFAULTS[type]).forEach((key) => {
      let v = key in prefs && !CONTENT_KEYS.includes(key) ? prefs[key] : DEFAULTS[type][key];
      if (SIZE_KEYS.includes(key) && typeof v === 'number') v = Math.round(v * k * 10) / 10;
      out[key] = v;
    });
    return out;
  }

  function rememberStyle(obj, keys) {
    const k = sizeFactor();
    const prefs = (store.stylePrefs[obj.type] = store.stylePrefs[obj.type] || {});
    let touched = false;
    keys.forEach((key) => {
      if (CONTENT_KEYS.includes(key) || !(key in DEFAULTS[obj.type])) return;
      prefs[key] = SIZE_KEYS.includes(key) ? obj[key] / k : obj[key];
      touched = true;
    });
    if (touched && store.onPrefsChange) store.onPrefsChange(store.stylePrefs);
  }

  /* ---------- Objetos ---------- */

  function newNode(x, y) {
    const id = U.uid('n');
    store.doc.nodes[id] = { x, y };
    return id;
  }

  function create(type, props, opts) {
    if (!(opts && opts.skipCheckpoint)) checkpoint();
    const obj = Object.assign({ id: U.uid('o'), type, visible: true, locked: false }, styleFor(type), props);
    store.doc.objects.push(obj);
    store.sel = { id: obj.id, node: null };
    changed();
    emit('select');
    return obj;
  }

  function update(id, patch, key) {
    const obj = get(id);
    if (!obj) return;
    checkpoint(key === undefined ? 'upd:' + id + ':' + Object.keys(patch).join(',') : key);
    Object.assign(obj, patch);
    rememberStyle(obj, Object.keys(patch));
    changed();
  }

  function setDocField(path, value, key) {
    checkpoint(key === undefined ? 'doc:' + path : key);
    const parts = path.split('.');
    let target = store.doc;
    while (parts.length > 1) target = target[parts.shift()];
    target[parts[0]] = value;
    changed();
  }

  function remove(id) {
    if (!get(id)) return;
    checkpoint();
    store.doc.objects = store.doc.objects.filter((o) => o.id !== id);
    if (store.sel.id === id) store.sel = { id: null, node: null };
    cleanupNodes();
    changed();
    emit('select');
  }

  function duplicate(id) {
    const obj = get(id);
    if (!obj) return null;
    checkpoint();
    const off = 24 * sizeFactor();
    const copy = U.clone(obj);
    copy.id = U.uid('o');
    copy.locked = false;
    copy.visible = true;
    if (copy.points) copy.points = points(obj).map((p) => newNode(p.x + off, p.y + off));
    else { copy.x += off; copy.y += off; }
    const idx = store.doc.objects.indexOf(obj);
    store.doc.objects.splice(idx + 1, 0, copy);
    store.sel = { id: copy.id, node: null };
    changed();
    emit('select');
    return copy;
  }

  // Move dentro do mesmo grupo de desenho (é o que muda visualmente).
  function reorder(id, dir) {
    const objs = store.doc.objects;
    const i = objs.findIndex((o) => o.id === id);
    if (i < 0) return false;
    const g = groupOf(objs[i].type);
    for (let j = i + dir; j >= 0 && j < objs.length; j += dir) {
      if (groupOf(objs[j].type) === g) {
        checkpoint();
        const t = objs[i]; objs[i] = objs[j]; objs[j] = t;
        changed();
        return true;
      }
    }
    return false;
  }

  function moveBy(obj, dx, dy) {
    if (obj.points) {
      new Set(obj.points).forEach((id) => { const n = node(id); if (n) { n.x += dx; n.y += dy; } });
    } else {
      obj.x += dx; obj.y += dy;
    }
  }

  /* ---------- Operações com pontos (nós compartilhados) ---------- */

  function cleanupNodes(doc) {
    const d = doc || store.doc;
    const used = new Set();
    d.objects.forEach((o) => (o.points || []).forEach((id) => used.add(id)));
    Object.keys(d.nodes).forEach((id) => { if (!used.has(id)) delete d.nodes[id]; });
  }

  function nearestSegment(obj, p) {
    const pts = points(obj);
    const closed = obj.type === 'area';
    const n = closed ? pts.length : pts.length - 1;
    let best = null;
    for (let i = 0; i < n; i++) {
      const r = U.projectOnSegment(p, pts[i], pts[(i + 1) % pts.length]);
      if (!best || r.d < best.d) best = Object.assign(r, { index: i });
    }
    return best;
  }

  function insertNode(obj, segIndex, nodeId) {
    obj.points.splice(segIndex + 1, 0, nodeId);
  }

  function insertOnNearestSegment(obj, nodeId) {
    const seg = nearestSegment(obj, node(nodeId));
    if (seg) insertNode(obj, seg.index, nodeId);
  }

  function removeVertex(objId, nodeId) {
    const obj = get(objId);
    if (!obj || !obj.points) return false;
    const idx = obj.points.indexOf(nodeId);
    if (idx < 0 || obj.points.length <= MIN_POINTS[obj.type]) return false;
    checkpoint();
    obj.points.splice(idx, 1);
    store.sel = { id: objId, node: null };
    cleanupNodes();
    changed();
    emit('select');
    return true;
  }

  function splitRoad(objId, nodeId) {
    const obj = get(objId);
    if (!obj || obj.type !== 'road') return null;
    const idx = obj.points.indexOf(nodeId);
    if (idx <= 0 || idx >= obj.points.length - 1) return null;
    checkpoint();
    const second = U.clone(obj);
    second.id = U.uid('o');
    second.points = obj.points.slice(idx);
    obj.points = obj.points.slice(0, idx + 1);
    store.doc.objects.splice(store.doc.objects.indexOf(obj) + 1, 0, second);
    store.sel = { id: second.id, node: null };
    changed();
    emit('select');
    return second;
  }

  function detachNode(objId, nodeId) {
    const obj = get(objId);
    const n = node(nodeId);
    if (!obj || !n || nodeUsage(nodeId) < 2) return false;
    checkpoint();
    const id = newNode(n.x, n.y);
    obj.points = obj.points.map((p) => (p === nodeId ? id : p));
    store.sel = { id: objId, node: id };
    changed();
    emit('select');
    return true;
  }

  function dedupeConsecutive(obj) {
    const out = [];
    obj.points.forEach((id) => { if (out[out.length - 1] !== id) out.push(id); });
    if (obj.type === 'area' && out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    return out;
  }

  // Une dois nós: todas as referências a `src` passam a usar `dst`.
  function mergeNodes(src, dst) {
    if (!src || !dst || src === dst || !node(src) || !node(dst)) return false;
    const objs = store.doc.objects.filter((o) => o.points && o.points.includes(src));
    for (const o of objs) {
      const test = { type: o.type, points: o.points.map((p) => (p === src ? dst : p)) };
      if (dedupeConsecutive(test).length < MIN_POINTS[o.type]) return false;
    }
    objs.forEach((o) => { o.points = dedupeConsecutive({ type: o.type, points: o.points.map((p) => (p === src ? dst : p)) }); });
    delete store.doc.nodes[src];
    if (store.sel.node === src) store.sel.node = dst;
    return true;
  }

  // Transforma cruzamentos visuais entre ruas em junções reais.
  function crossRoads(onlyIds, tol) {
    const roads = store.doc.objects.filter((o) => o.type === 'road' && o.visible !== false);
    const t = tol || 3;
    let count = 0;
    for (let i = 0; i < roads.length; i++) {
      for (let j = i + 1; j < roads.length; j++) {
        const A = roads[i], B = roads[j];
        if (onlyIds && !onlyIds.includes(A.id) && !onlyIds.includes(B.id)) continue;
        let guard = 0, again = true;
        while (again && guard++ < 200) {
          again = false;
          const pa = points(A), pb = points(B);
          for (let ai = 0; ai < pa.length - 1 && !again; ai++) {
            for (let bi = 0; bi < pb.length - 1 && !again; bi++) {
              const hit = U.segmentIntersection(pa[ai], pa[ai + 1], pb[bi], pb[bi + 1], 0);
              if (!hit) continue;
              const near = (pts, k, ids) => (U.dist(pts[k], hit) <= t ? ids[k] : U.dist(pts[k + 1], hit) <= t ? ids[k + 1] : null);
              const na = near(pa, ai, A.points), nb = near(pb, bi, B.points);
              if (na && nb) {
                if (na === nb || !mergeNodes(nb, na)) continue;
              } else if (na) {
                if (B.points.includes(na)) continue;
                insertNode(B, bi, na);
              } else if (nb) {
                if (A.points.includes(nb)) continue;
                insertNode(A, ai, nb);
              } else {
                const id = newNode(hit.x, hit.y);
                insertNode(A, ai, id);
                insertNode(B, bi, id);
              }
              count++;
              again = true;
            }
          }
        }
      }
    }
    return count;
  }

  /* ---------- Ajustes em grupo ---------- */

  // Quadra = área criada pelo mapa ou área cujo nome é só um número.
  const isBlock = (o) => o.type === 'area' && (o.role === 'block' || /^\d+$/.test(String(o.name || '').trim()));
  const blockNumber = (o) => { const n = parseInt(String(o.name || '').trim(), 10); return isNaN(n) ? Infinity : n; };

  // Aplica uma alteração a vários itens como um único passo de desfazer.
  // Passos seguidos com a mesma chave (ex.: vários cliques em "+") se juntam.
  function updateMany(objs, fn, key) {
    if (!objs.length) return 0;
    checkpoint(key || null);
    objs.forEach(fn);
    changed();
    return objs.length;
  }

  // Fecha buracos na numeração (1, 2, 4, 5 → 1, 2, 3, 4), mantendo a ordem.
  function renumberBlocks() {
    const list = store.doc.objects.filter(isBlock);
    const sorted = list.map((o, i) => ({ o, i })).sort((a, b) => blockNumber(a.o) - blockNumber(b.o) || a.i - b.i).map((x) => x.o);
    if (sorted.every((o, i) => String(o.name).trim() === String(i + 1))) return 0;
    return updateMany(sorted, (o) => { o.name = String(sorted.indexOf(o) + 1); });
  }

  App.model = { isBlock, blockNumber, TYPES, GROUPS, DRAW_ORDER, groupOf, ICONS, iconById, FRAMES, DEFAULTS, MIN_POINTS, newDoc, normalize, migrateLegacy, frameRatio, fitFrame };
  App.store = Object.assign(store, {
    on, emit, changed, checkpoint, breakMerge, dropLastCheckpoint, undo, redo, setDoc,
    get, node, points, selected, isPath, nodeUsage, sizeFactor, select, styleFor,
    newNode, create, update, updateMany, renumberBlocks, setDocField, remove, duplicate, reorder, moveBy,
    cleanupNodes, nearestSegment, insertNode, insertOnNearestSegment, removeVertex, splitRoad, detachNode, mergeNodes, crossRoads,
    canUndo: () => store.past.length > 0,
    canRedo: () => store.future.length > 0
  });
})();
