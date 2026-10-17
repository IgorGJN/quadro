/* Mapa geral: todos os cartões que têm localização, num mapa só, para ver o
   panorama da região, conferir o que já foi feito e achar quadras repetidas. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;
  const VM = App.vectormap;

  const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#0d9488', '#65a30d', '#be123c'];
  const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });

  /* ---------- Geometria dos territórios ---------- */

  // Matriz do desenho para coordenadas globais. Cartões criados antes de a
  // matriz ser guardada são reconstruídos a partir do centro, da escala e do
  // fato de o fundo ser centrado nas quadras escolhidas.
  function geoMatrix(doc) {
    const g = doc.geo;
    if (!g) return null;
    if (Array.isArray(g.toG) && g.toG.length === 6) return g.toG;
    if (g.source !== 'openfreemap' || !g.center || !g.metersPerUnit || !doc.base.width) return null;
    const pts = doc.objects.filter(M.isBlock).flatMap((o) => o.points.map((id) => doc.nodes[id]).filter(Boolean));
    if (!pts.length) return null;
    const c0 = VM.toG(g.center[0], g.center[1]);
    const k = VM.metersPerUnit(c0.y) / g.metersPerUnit;
    const a = ((g.angle || 0) * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
    const half = { x: doc.base.width / 2, y: doc.base.height / 2 };
    const bb = U.bounds(pts.map((p) => {
      const v = { x: (p.x - half.x) / k, y: (p.y - half.y) / k };
      return { x: cs * v.x + sn * v.y, y: -sn * v.x + cs * v.y };
    }));
    const m = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
    const E = { x: -(cs * m.x - sn * m.y) - half.x / k, y: -(sn * m.x + cs * m.y) - half.y / k };
    return [cs / k, -sn / k, sn / k, cs / k, cs * E.x + sn * E.y + c0.x, -sn * E.x + cs * E.y + c0.y];
  }

  function ringArea(pts) {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    return Math.abs(a / 2);
  }

  // O território é formado pelas quadras; sem quadras, pelas áreas desenhadas;
  // sem áreas, pelo próprio retângulo do cartão.
  function territoryOf(entry) {
    const doc = M.normalize(entry.doc);
    const m = geoMatrix(doc);
    if (!m) return null;
    const toG = (p) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
    const ring = (o) => (o.points || []).map((id) => doc.nodes[id]).filter(Boolean).map(toG);
    const vis = doc.objects.filter((o) => o.visible !== false);
    let kind = 'blocks';
    let parts = vis.filter(M.isBlock).map((o) => ({ ring: ring(o), num: String(o.name || '').trim() }));
    if (!parts.length) { kind = 'areas'; parts = vis.filter((o) => o.type === 'area').map((o) => ({ ring: ring(o), num: '' })); }
    if (!parts.length) {
      kind = 'frame';
      const f = doc.frame;
      parts = [{ ring: [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]].map(([x, y]) => toG({ x, y })), num: '' }];
    }
    parts = parts.filter((p) => p.ring.length >= 3);
    if (!parts.length) return null;
    parts.forEach((p) => { p.lp = U.polygonLabelPoint(p.ring); p.area = ringArea(p.ring); p.bbox = U.bounds(p.ring); });
    const bbox = U.bounds(parts.flatMap((p) => p.ring));
    const c = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
    const lp = parts.some((p) => U.pointInPolygon(c, p.ring)) ? c : parts.slice().sort((a, b) => U.dist(a.lp, c) - U.dist(b.lp, c))[0].lp;
    return { id: entry.id, name: doc.name || 'Sem nome', updatedAt: doc.updatedAt, thumb: entry.thumb, parts, kind, bbox, lp };
  }

  // Cores diferentes para territórios vizinhos.
  function assignColors(list) {
    const near = (a, b, m) => a.bbox.x - m < b.bbox.x + b.bbox.w && b.bbox.x - m < a.bbox.x + a.bbox.w && a.bbox.y - m < b.bbox.y + b.bbox.h && b.bbox.y - m < a.bbox.y + a.bbox.h;
    list.forEach((t, i) => {
      const margin = 80 / VM.metersPerUnit(t.bbox.y);
      const used = new Set(list.slice(0, i).filter((o) => near(o, t, margin)).map((o) => o.color));
      // Entre as cores livres, a menos usada até aqui (cores repetem só quando acabam)
      const count = (c) => list.slice(0, i).filter((o) => o.color === c).length;
      const free = PALETTE.filter((c) => !used.has(c));
      t.color = (free.length ? free : PALETTE).reduce((a, b) => (count(b) < count(a) ? b : a));
    });
  }

  // Quadras que aparecem em mais de um cartão.
  function findOverlaps(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        const bb = A.bbox, cc = B.bbox;
        if (bb.x > cc.x + cc.w || cc.x > bb.x + bb.w || bb.y > cc.y + cc.h || cc.y > bb.y + bb.h) continue;
        // Conta cada quadra de A uma vez, olhando dos dois lados
        const spots = [];
        const counted = new Set();
        A.parts.forEach((p, k) => { if (B.parts.some((q) => U.pointInPolygon(p.lp, q.ring))) { spots.push(p.lp); counted.add(k); } });
        B.parts.forEach((q) => {
          const k = A.parts.findIndex((p) => U.pointInPolygon(q.lp, p.ring));
          if (k >= 0 && !counted.has(k)) { spots.push(q.lp); counted.add(k); }
        });
        if (spots.length) out.push({ a: A, b: B, spots });
      }
    }
    return out;
  }

  async function loadTerritories() {
    await App.actions.saveNow();
    const entries = await App.storage.listDocs();
    const located = [], missing = [];
    entries.forEach((e) => {
      let t = null;
      try { t = territoryOf(e); } catch (err) { console.warn(err); }
      if (t) located.push(t);
      else missing.push({ id: e.id, name: e.doc.name || 'Sem nome', updatedAt: e.doc.updatedAt });
    });
    located.sort(byName);
    missing.sort(byName);
    assignColors(located);
    return { located, missing, overlaps: findOverlaps(located) };
  }

  /* ---------- Imagem para baixar ou imprimir ---------- */

  async function renderImage(list, onProgress) {
    const all = U.bounds(list.flatMap((t) => [{ x: t.bbox.x, y: t.bbox.y }, { x: t.bbox.x + t.bbox.w, y: t.bbox.y + t.bbox.h }]));
    const pad = Math.max(all.w, all.h) * 0.06 + 150 / VM.metersPerUnit(all.y);
    const bb = { x: all.x - pad, y: all.y - pad, w: all.w + pad * 2, h: all.h + pad * 2 };
    let z = 18;
    const px = (zz) => (Math.max(bb.w, bb.h) * Math.pow(2, zz) * 256) / VM.WORLD;
    while (z > 3 && px(z) > 3600) z--;
    const s = (Math.pow(2, z) * 256) / VM.WORLD;
    const W = Math.round(bb.w * s), H = Math.round(bb.h * s);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    c.fillStyle = '#f2efe9';
    c.fillRect(0, 0, W, H);

    // Fundo do OpenStreetMap em tons de cinza, para os territórios se destacarem
    const src = App.osm.SOURCES.osm;
    const p1 = { x: bb.x * s, y: bb.y * s };
    const n = Math.pow(2, z);
    const tiles = [];
    for (let tx = Math.floor(p1.x / 256); tx <= Math.floor((p1.x + W) / 256); tx++) {
      for (let ty = Math.floor(p1.y / 256); ty <= Math.floor((p1.y + H) / 256); ty++) if (ty >= 0 && ty < n) tiles.push({ tx, ty });
    }
    let done = 0;
    const queue = tiles.slice();
    const worker = async () => {
      while (queue.length) {
        const t = queue.shift();
        const img = await App.osm.loadTile(App.osm.tileUrl(src, z, ((t.tx % n) + n) % n, t.ty));
        if (img) {
          c.filter = 'grayscale(75%) brightness(1.05)';
          c.drawImage(img, t.tx * 256 - p1.x, t.ty * 256 - p1.y);
          c.filter = 'none';
        }
        onProgress(++done / tiles.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    const P = (p) => ({ x: p.x * s - p1.x, y: p.y * s - p1.y });
    const lw = Math.max(2, W / 900);
    list.forEach((t) => t.parts.forEach((p) => {
      c.beginPath();
      p.ring.map(P).forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
      c.closePath();
      c.fillStyle = U.hexToRgba(t.color, 0.38);
      c.fill();
      c.lineJoin = 'round';
      c.lineWidth = lw;
      c.strokeStyle = t.color;
      c.stroke();
    }));
    const fs = Math.max(14, Math.min(W, H) / 55);
    list.forEach((t) => {
      const q = P(t.lp);
      c.font = '700 ' + fs + 'px ' + App.render.FONT;
      const tw = c.measureText(t.name).width;
      App.render.roundRect(c, q.x - tw / 2 - fs * 0.5, q.y - fs * 0.8, tw + fs, fs * 1.6, fs * 0.45);
      c.fillStyle = 'rgba(255,255,255,.94)';
      c.fill();
      c.lineWidth = Math.max(1.5, fs * 0.12);
      c.strokeStyle = t.color;
      c.stroke();
      c.fillStyle = '#16203a';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(t.name, q.x, q.y + fs * 0.04);
    });

    // Título e atribuição
    const title = 'Mapa geral dos territórios';
    const sub = list.length + (list.length === 1 ? ' território' : ' territórios') + ' · ' + new Date().toLocaleDateString('pt-BR');
    const tf = Math.max(18, Math.min(W, H) / 38);
    c.font = '700 ' + tf + 'px ' + App.render.FONT;
    const w1 = c.measureText(title).width;
    c.font = '500 ' + tf * 0.62 + 'px ' + App.render.FONT;
    const w2 = c.measureText(sub).width;
    App.render.roundRect(c, tf * 0.6, tf * 0.6, Math.max(w1, w2) + tf * 1.2, tf * 2.5, tf * 0.4);
    c.fillStyle = 'rgba(255,255,255,.94)';
    c.fill();
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#16203a';
    c.font = '700 ' + tf + 'px ' + App.render.FONT;
    c.fillText(title, tf * 1.2, tf * 1.75);
    c.fillStyle = '#4b5563';
    c.font = '500 ' + tf * 0.62 + 'px ' + App.render.FONT;
    c.fillText(sub, tf * 1.2, tf * 2.65);
    const af = Math.max(10, W * 0.008);
    c.font = '500 ' + af + 'px ' + App.render.FONT;
    const at = src.attribution;
    const aw = c.measureText(at).width;
    c.fillStyle = 'rgba(255,255,255,.8)';
    c.fillRect(W - aw - af * 1.2, H - af * 1.7, aw + af * 1.2, af * 1.7);
    c.fillStyle = '#333';
    c.textAlign = 'right';
    c.textBaseline = 'bottom';
    c.fillText(at, W - af * 0.6, H - af * 0.35);
    return canvas;
  }

  function printCanvas(canvas) {
    const url = canvas.toDataURL('image/png');
    const landscape = canvas.width >= canvas.height;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><title>Mapa geral dos territórios</title><style>@page{size:' + (landscape ? 'landscape' : 'portrait') + ';margin:8mm}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;display:block}</style></head><body><img src="' + url + '"></body></html>';
    frame.onload = () => {
      const w = frame.contentWindow;
      const img = w.document.querySelector('img');
      const go = () => { w.focus(); w.print(); setTimeout(() => frame.remove(), 60000); };
      if (img.complete) go(); else img.onload = go;
    };
    document.body.appendChild(frame);
  }

  /* ---------- Janela ---------- */

  async function open() {
    const icon = App.ui.icon;
    const esc = U.escapeHtml;
    const body = document.createElement('div');
    body.className = 'ov';
    body.innerHTML = '<div class="ov-map-wrap"><div class="ov-map"></div><div class="ov-card" hidden></div><div class="ov-empty" hidden></div></div><aside class="ov-side"><p class="note">Carregando…</p></aside>';
    const m = App.ui.modal({ title: 'Mapa geral dos territórios', body, className: 'ov-dialog' });
    const progress = document.createElement('div');
    progress.className = 'osm-progress ov-progress';
    progress.hidden = true;
    progress.innerHTML = '<div></div>';
    const dl = document.createElement('button');
    dl.className = 'btn';
    dl.innerHTML = icon('download') + 'Baixar imagem';
    const pr = document.createElement('button');
    pr.className = 'btn primary';
    pr.innerHTML = icon('print') + 'Imprimir';
    m.foot.append(progress, dl, pr);

    const side = body.querySelector('.ov-side');
    const mapEl = body.querySelector('.ov-map');
    const card = body.querySelector('.ov-card');
    const empty = body.querySelector('.ov-empty');

    let data;
    try { data = await loadTerritories(); }
    catch (err) { console.error(err); side.innerHTML = '<p class="note">Não foi possível ler os mapas salvos.</p>'; return; }
    const L = await App.osm.loadLeaflet().catch(() => null);
    if (!L) mapEl.innerHTML = '<div class="empty" style="padding-top:80px">' + icon('globe') + '<strong>Sem conexão</strong><p>O Mapa geral precisa de internet para mostrar o mapa da cidade.</p></div>';
    if (!document.body.contains(m.dlg)) return;
    const { located, missing, overlaps } = data;
    dl.disabled = pr.disabled = !located.length || !L;

    // Lista lateral
    const blocksOf = (t) => (t.kind === 'blocks' ? t.parts.length + (t.parts.length === 1 ? ' quadra' : ' quadras') : t.kind === 'areas' ? 'áreas desenhadas' : 'área do cartão');
    let html = '<div class="ov-summary"><strong>' + located.length + '</strong> ' + (located.length === 1 ? 'território no mapa' : 'territórios no mapa') +
      (located.length ? ' · ' + located.reduce((n, t) => n + (t.kind === 'blocks' ? t.parts.length : 0), 0) + ' quadras' : '') + '</div>';
    if (overlaps.length) {
      html += '<div class="callout warn">' + icon('alert') + '<div><b>Quadras em mais de um território</b>' +
        overlaps.map((o, i) => '<button class="link" data-overlap="' + i + '">' + esc(o.a.name) + ' e ' + esc(o.b.name) + ' (' + o.spots.length + ')</button>').join('') + '</div></div>';
    }
    html += '<div class="ov-list">' + located.map((t) => '<button class="ov-item" data-id="' + t.id + '"><span class="ov-swatch" style="background:' + t.color + '"></span><span class="grow"><strong>' + esc(t.name) + '</strong><small>' + blocksOf(t) + ' · ' + U.relativeTime(t.updatedAt) + '</small></span></button>').join('') + '</div>';
    if (missing.length) {
      html += '<details class="ov-missing"' + (located.length ? '' : ' open') + '><summary>Sem localização (' + missing.length + ')</summary><p class="note">Mapas feitos com print ou em branco não sabem onde ficam. Refaça com <b>Criar pelo mapa</b> para que apareçam aqui.</p>' +
        missing.map((t) => '<button class="ov-item" data-open="' + t.id + '"><span class="ov-swatch empty"></span><span class="grow"><strong>' + esc(t.name) + '</strong><small>' + U.relativeTime(t.updatedAt) + '</small></span></button>').join('') + '</details>';
    }
    side.innerHTML = html;

    const openCard = (id) => { m.close(); if (id !== App.store.doc.id) App.actions.openProject(id); };
    side.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openCard(b.dataset.open)));

    if (!located.length) {
      empty.hidden = false;
      empty.innerHTML = '<div class="empty">' + icon('globe') + '<strong>Nenhum território no mapa ainda</strong><p>Os cartões feitos com <b>Criar pelo mapa</b> aparecem aqui automaticamente.</p><button class="btn primary" data-new>' + icon('wand') + 'Criar pelo mapa</button></div>';
      empty.querySelector('[data-new]').addEventListener('click', async () => { m.close(); await App.actions.newProject(); App.territory.open(); });
    }
    if (!L) return;

    // Mapa
    const ll = (p) => VM.toLatLng(p.x, p.y);
    const map = L.map(mapEl, { zoomControl: true, attributionControl: true, preferCanvas: true });
    const src = App.osm.SOURCES.osm;
    L.tileLayer(src.url, { maxZoom: src.maxZoom, attribution: src.attribution }).addTo(map);
    const renderer = L.canvas({ padding: 0.3 });
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl);
    m.dlg.addEventListener('close', () => { ro.disconnect(); map.remove(); });

    const numbers = L.layerGroup();
    const layers = new Map();
    let current = null;
    const style = (t, on) => ({ renderer, color: t.color, weight: on ? 4 : 2, opacity: 1, fillColor: t.color, fillOpacity: on ? 0.5 : 0.32 });
    located.forEach((t) => {
      const polys = t.parts.map((p) => L.polygon(p.ring.map(ll), style(t, false)).on('click', () => select(t, false)));
      const label = L.marker(ll(t.lp), { icon: L.divIcon({ className: 'ov-label', html: '<span style="border-color:' + t.color + '">' + esc(t.name) + '</span>', iconSize: [0, 0] }), keyboard: false, riseOnHover: true })
        .on('click', () => select(t, false));
      const group = L.featureGroup(polys).addTo(map);
      label.addTo(map);
      layers.set(t.id, { t, polys, group });
      t.parts.forEach((p) => { if (p.num) numbers.addLayer(L.marker(ll(p.lp), { interactive: false, keyboard: false, icon: L.divIcon({ className: 'ov-num', html: '<span>' + esc(p.num) + '</span>', iconSize: [0, 0] }) })); });
    });
    // Números das quadras só com o mapa bem aproximado
    const toggleNumbers = () => { if (map.getZoom() >= 16) numbers.addTo(map); else numbers.remove(); };
    map.on('zoomend', toggleNumbers);

    const allBounds = () => L.latLngBounds(located.flatMap((t) => [ll({ x: t.bbox.x, y: t.bbox.y }), ll({ x: t.bbox.x + t.bbox.w, y: t.bbox.y + t.bbox.h })]));
    if (located.length) map.fitBounds(allBounds(), { padding: [30, 30], maxZoom: 17, animate: false });
    else {
      const v = App.storage.getPrefs().osmView || { lat: -15.78, lng: -47.93, z: 4 };
      map.setView([v.lat, v.lng], v.z);
    }
    toggleNumbers();

    function select(t, zoom) {
      if (current) layers.get(current.id).polys.forEach((p) => p.setStyle(style(current, false)));
      current = t;
      side.querySelectorAll('.ov-item[data-id]').forEach((b) => b.classList.toggle('active', b.dataset.id === t.id));
      const entry = layers.get(t.id);
      entry.polys.forEach((p) => { p.setStyle(style(t, true)); p.bringToFront(); });
      if (zoom) map.fitBounds(entry.group.getBounds(), { padding: [40, 40], maxZoom: 18 });
      card.hidden = false;
      card.innerHTML = (t.thumb ? '<div class="ov-thumb" style="background-image:url(' + t.thumb + ')"></div>' : '') +
        '<div class="ov-card-body"><strong>' + esc(t.name) + '</strong><small>' + blocksOf(t) + ' · atualizado ' + U.relativeTime(t.updatedAt) + '</small>' +
        '<div class="ov-card-actions"><button class="btn small" data-zoom>' + icon('target') + 'Aproximar</button><button class="btn small primary" data-go>' + icon('crop') + 'Abrir cartão</button></div></div>' +
        '<button class="icon-btn small ov-card-x" aria-label="Fechar">' + icon('x') + '</button>';
      card.querySelector('[data-zoom]').onclick = () => map.fitBounds(entry.group.getBounds(), { padding: [40, 40], maxZoom: 18 });
      card.querySelector('[data-go]').onclick = () => openCard(t.id);
      card.querySelector('.ov-card-x').onclick = () => {
        card.hidden = true;
        entry.polys.forEach((p) => p.setStyle(style(t, false)));
        side.querySelectorAll('.ov-item.active').forEach((b) => b.classList.remove('active'));
        current = null;
      };
    }

    side.querySelectorAll('.ov-item[data-id]').forEach((b) => b.addEventListener('click', () => select(layers.get(b.dataset.id).t, true)));
    side.querySelectorAll('[data-overlap]').forEach((b) => b.addEventListener('click', () => {
      const o = overlaps[+b.dataset.overlap];
      const pts = o.spots.map(ll);
      map.fitBounds(L.latLngBounds(pts).pad(0.5), { maxZoom: 18 });
      pts.forEach((p) => L.circleMarker(p, { radius: 14, color: '#dc2626', weight: 3, fill: false }).addTo(map));
    }));

    const exportImage = async (kind) => {
      dl.disabled = pr.disabled = true;
      progress.hidden = false;
      const bar = progress.firstElementChild;
      try {
        const canvas = await renderImage(located, (p) => { bar.style.width = Math.round(p * 100) + '%'; });
        if (kind === 'print') printCanvas(canvas);
        else {
          U.downloadBlob('mapa-geral-territorios.png', await U.canvasToBlob(canvas));
          App.ui.toast('Imagem do mapa geral baixada.', { type: 'ok' });
        }
      } catch (err) {
        console.error(err);
        App.ui.toast('Não foi possível montar a imagem. Verifique a conexão.', { type: 'error' });
      }
      dl.disabled = pr.disabled = false;
      progress.hidden = true;
    };
    dl.addEventListener('click', () => exportImage('png'));
    pr.addEventListener('click', () => exportImage('print'));
  }

  App.overview = { open, loadTerritories, renderImage, geoMatrix };
})();
