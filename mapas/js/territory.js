/* Criar cartão pelo mapa: a pessoa toca nas quadras do território (ou contorna
   a região) e o cartão é montado sozinho, com ruas nomeadas, quadras
   numeradas na ordem do toque e pontos de referência. Tudo continua editável. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;
  const VM = App.vectormap;

  const MIN_ZOOM = 15;
  const BLOCK_FILL = '#fbbf24';
  const BLOCK_STROKE = '#b45309';

  /* ---------- Geometria auxiliar ---------- */

  const sameFace = (sel, face) => U.pointInPolygon(sel.lp, face.pts) && face.m2 / sel.m2 > 0.7 && face.m2 / sel.m2 < 1.45;

  function ringArea(pts) {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    return Math.abs(a / 2);
  }

  function simplify(pts, tol) {
    if (pts.length < 4) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let best = -1, bestD = tol;
      for (let i = a + 1; i < b; i++) {
        const d = U.projectOnSegment(pts[i], pts[a], pts[b]).d;
        if (d > bestD) { bestD = d; best = i; }
      }
      if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    return pts.filter((p, i) => keep[i]);
  }

  // Ângulo que melhor aproveita o formato do cartão (0 quando o ganho é pequeno).
  function bestAngle(pts, c, ratio) {
    let best = 0, bestS = Infinity, s0 = Infinity;
    for (let deg = -89; deg <= 90; deg++) {
      const a = (deg * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
      let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      for (const p of pts) {
        const dx = p.x - c.x, dy = p.y - c.y;
        const x = cs * dx - sn * dy, y = sn * dx + cs * dy;
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
      const s = Math.max(x2 - x1, (y2 - y1) * ratio);
      if (deg === 0) s0 = s;
      if (s < bestS - 1e-9) { bestS = s; best = deg; }
    }
    return s0 <= bestS * 1.06 ? 0 : (best * Math.PI) / 180;
  }

  // Junta os trechos da malha em ruas contínuas (mesmo nome, ou mesma classe
  // quando não há nome), seguindo sempre o trecho mais reto nos cruzamentos.
  function chainEdges(nodes, edges) {
    const key = (e) => (e.name ? 'n:' + e.name : 'c:' + e.cls);
    const adj = new Map();
    const push = (n, i) => { if (!adj.has(n)) adj.set(n, []); adj.get(n).push(i); };
    edges.forEach((e, i) => { push(e.u, i); push(e.v, i); });
    const used = new Uint8Array(edges.length);
    const chains = [];
    const walk = (start, first) => {
      const k = key(edges[first]);
      const pts = [start];
      let node = start, cur = first, cls = edges[first].cls;
      for (;;) {
        used[cur] = 1;
        const e = edges[cur];
        if (VM.ROAD[e.cls].rank > VM.ROAD[cls].rank) cls = e.cls;
        const next = e.u === node ? e.v : e.u;
        pts.push(next);
        const cands = adj.get(next).filter((i) => !used[i] && key(edges[i]) === k);
        if (!cands.length) break;
        const a = nodes[node], b = nodes[next];
        const dir = Math.atan2(b.y - a.y, b.x - a.x);
        let best = -1, bestD = Infinity;
        cands.forEach((i) => {
          const f = edges[i];
          const o = nodes[f.u === next ? f.v : f.u];
          let d = Math.abs(Math.atan2(o.y - b.y, o.x - b.x) - dir);
          if (d > Math.PI) d = 2 * Math.PI - d;
          if (d < bestD) { bestD = d; best = i; }
        });
        if (bestD > Math.PI * 0.45) break; // curva fechada: começa outro trecho
        node = next;
        cur = best;
      }
      chains.push({ name: edges[first].name, cls, nodes: pts });
    };
    const sameDeg = (n, k) => adj.get(n).filter((i) => key(edges[i]) === k).length;
    adj.forEach((list, n) => list.forEach((i) => { if (!used[i] && sameDeg(n, key(edges[i])) !== 2) walk(n, i); }));
    edges.forEach((e, i) => { if (!used[i]) walk(e.u, i); });
    return chains;
  }

  /* ---------- Montagem do cartão ---------- */

  async function build(sel, opts, progress) {
    const preset = M.FRAMES[opts.preset] ? opts.preset : 'card';
    const ratio = M.FRAMES[preset].w / M.FRAMES[preset].h;
    const all = sel.flatMap((s) => s.ring);
    const bb = U.bounds(all);
    const c0 = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
    const mpu = VM.metersPerUnit(c0.y);
    const angle = opts.orient === 'fit' ? bestAngle(all, c0, ratio) : 0;
    const cs = Math.cos(angle), sn = Math.sin(angle);
    const rot = (p) => ({ x: cs * (p.x - c0.x) - sn * (p.y - c0.y), y: sn * (p.x - c0.x) + cs * (p.y - c0.y) });
    const unrot = (q) => ({ x: cs * q.x + sn * q.y + c0.x, y: -sn * q.x + cs * q.y + c0.y });

    // Cartão = território + margem (para as ruas em volta e seus nomes),
    // no formato escolhido. O fundo cobre uma folga extra em volta do cartão.
    const b = U.bounds(all.map(rot));
    const pad = Math.max(45 / mpu, Math.max(b.w, b.h) * 0.14);
    let fw = b.w + pad * 2, fh = b.h + pad * 2;
    if (fw / fh < ratio) fw = fh * ratio; else fh = fw / ratio;
    const F = { x: b.x + b.w / 2 - fw / 2, y: b.y + b.h / 2 - fh / 2, w: fw, h: fh };
    const E = { x: F.x - fw * 0.2, y: F.y - fh * 0.2, w: fw * 1.4, h: fh * 1.4 };
    const k = 1400 / fw;
    const toW = (p) => { const q = rot(p); return { x: (q.x - E.x) * k, y: (q.y - E.y) * k }; };
    const Ew = E.w * k, Eh = E.h * k;
    const frame = { x: (F.x - E.x) * k, y: (F.y - E.y) * k, w: 1400, h: 1400 / ratio, preset };

    const corners = [[E.x, E.y], [E.x + E.w, E.y], [E.x, E.y + E.h], [E.x + E.w, E.y + E.h]].map(([x, y]) => unrot({ x, y }));
    const tl = VM.tilesFor(U.bounds(corners));
    if (tl.length > 12) throw new Error('O território ficou grande demais para um cartão. Divida em territórios menores.');
    progress(0.15);
    const tiles = await VM.loadTiles(tl);
    progress(0.45);
    const graph = VM.buildGraph(tiles);
    progress(0.65);

    const doc = M.newDoc(opts.name || '');
    doc.frame = frame;
    doc.geo = { source: 'openfreemap', center: VM.toLatLng(c0.x, c0.y), angle: (angle * 180) / Math.PI, metersPerUnit: mpu / k };

    const nodeIds = new Map();
    const nid = (i) => {
      let id = nodeIds.get(i);
      if (!id) {
        const w = toW(graph.nodes[i]);
        id = U.uid('n');
        doc.nodes[id] = { x: Math.round(w.x * 100) / 100, y: Math.round(w.y * 100) / 100 };
        nodeIds.set(i, id);
      }
      return id;
    };
    const freeNode = (p) => {
      const w = toW(p);
      const id = U.uid('n');
      doc.nodes[id] = { x: w.x, y: w.y };
      return id;
    };

    // Quadras do território
    const kpm = k / mpu; // unidades do desenho por metro
    const blocks = sel.map((s, i) => {
      const face = s.free ? null : graph.faces.find((f) => sameFace(s, f));
      s.face = face;
      const points = face ? face.nodes.map(nid) : simplify(s.ring, 1.5).map(freeNode);
      const wpts = points.map((id) => doc.nodes[id]);
      const wb = U.bounds(wpts);
      return {
        obj: Object.assign({}, M.DEFAULTS.area, {
          id: U.uid('o'), type: 'area', role: 'block', visible: true, locked: false, points,
          name: String(i + 1), fill: BLOCK_FILL, fillOpacity: 0.55, stroke: BLOCK_STROKE,
          strokeWidth: face ? 0 : 4, dashed: !face, labelColor: '#1f2937'
        }),
        minSide: Math.min(wb.w, wb.h)
      };
    });
    const sides = blocks.map((b) => b.minSide).sort((m, n) => m - n);
    const labelSize = U.clamp(Math.round(sides[sides.length >> 1] * 0.36), 26, 64);
    blocks.forEach((b) => { b.obj.labelSize = labelSize; });

    const anchor = toW(c0);
    const terrNodes = new Set();
    sel.forEach((s) => { if (s.face) s.face.nodes.forEach((i) => terrNodes.add(i)); });

    // Ruas: tudo o que aparece no cartão e um pouco além (para editar com folga)
    const inside = (i) => {
      const w = toW(graph.nodes[i]);
      return w.x > -Ew * 0.02 && w.x < Ew * 1.02 && w.y > -Eh * 0.02 && w.y < Eh * 1.02;
    };
    const edges = graph.edges.filter((e) => inside(e.u) || inside(e.v));
    const roads = chainEdges(graph.nodes, edges)
      .filter((c) => c.nodes.length > 1)
      .map((c) => {
        const st = VM.ROAD[c.cls];
        const width = Math.round(U.clamp(st.m * kpm, st.m * 0.95, st.m * 4) * 10) / 10;
        const touches = c.nodes.some((i) => terrNodes.has(i));
        return {
          rank: st.rank,
          obj: Object.assign({}, M.DEFAULTS.road, {
            id: U.uid('o'), type: 'road', role: 'street', labelRank: touches ? 2 : st.rank >= 3 ? 1 : 0, labelAnchor: touches ? anchor : undefined, visible: true, locked: false,
            points: c.nodes.map(nid), name: c.name || '', showLabel: !!c.name,
            color: st.fill, casingColor: st.casing, width,
            casing: Math.round(U.clamp(width * 0.13, 1.5, 4) * 10) / 10,
            labelSize: st.label, labelColor: '#27303f', rounded: true
          })
        };
      })
      .sort((m, n) => m.rank - n.rank);
    progress(0.8);

    // Pontos de referência próximos ao território
    const markers = [];
    if (opts.pois) {
      const wRings = blocks.map((b) => b.obj.points.map((id) => doc.nodes[id]));
      const center = toW(c0);
      const inFrame = (p) => p.x > frame.x + 30 && p.x < frame.x + frame.w - 30 && p.y > frame.y + 30 && p.y < frame.y + frame.h - 30;
      const seen = new Set();
      const cands = [];
      tiles.forEach((t) => t.pois.forEach((p) => {
        const w = toW(p);
        const nameKey = p.name.toLowerCase();
        if (!inFrame(w) || seen.has(nameKey)) return;
        seen.add(nameKey);
        const def = VM.POI[p.cls];
        const inTerr = wRings.some((r) => U.pointInPolygon(w, r));
        const score = def.prio * 10 - Math.min(p.rank, 30) * 0.4 + (inTerr ? 25 : 0) - (U.dist(w, center) / frame.w) * 30;
        cands.push({ w, p, def, score });
      }));
      cands.sort((m, n) => n.score - m.score);
      // Números das quadras não podem ficar escondidos: o ponto é afastado
      // um pouco quando o nome dele cobriria um número.
      const numBoxes = blocks.map((b) => {
        const p = U.polygonLabelPoint(b.obj.points.map((id) => doc.nodes[id]));
        const w = labelSize * (0.62 * b.obj.name.length + 0.5), h = labelSize * 1.25;
        return { x: p.x - w / 2, y: p.y - h / 2, w, h };
      });
      const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const boxes = [];
      const d = labelSize * 0.9;
      const offsets = [[0, 0], [0, -d], [0, d], [-d, 0], [d, 0], [0, -2 * d], [0, 2 * d], [-2 * d, 0]];
      for (const c of cands) {
        if (markers.length >= 7) break;
        if (markers.some((m) => U.dist(m, c.w) < 150)) continue;
        const name = c.p.name.length > 32 ? c.p.name.slice(0, 30).trim() + '…' : c.p.name;
        const tw = name.length * 19 * 0.56;
        let spot = null;
        for (const [dx, dy] of offsets) {
          const box = { x: c.w.x + dx - 19, y: c.w.y + dy - 19, w: 38 + 8 + tw, h: 38 };
          if (!numBoxes.some((b) => hit(b, box)) && !boxes.some((b) => hit(b, box))) { spot = { x: c.w.x + dx, y: c.w.y + dy, box }; break; }
        }
        if (!spot) continue;
        boxes.push(spot.box);
        markers.push(Object.assign({}, M.DEFAULTS.marker, {
          id: U.uid('o'), type: 'marker', visible: true, locked: false,
          x: spot.x, y: spot.y, icon: c.def.icon, style: 'pin', color: c.def.color, size: 34, name, labelSize: 19
        }));
      }
    }

    const compass = Object.assign({}, M.DEFAULTS.compass, {
      id: U.uid('o'), type: 'compass', visible: true, locked: false,
      x: frame.x + frame.w - 62, y: frame.y + 68, size: 76, rotation: Math.round((angle * 180) / Math.PI)
    });

    // Mantém a seta (já girada) inteira dentro do cartão
    const cb = App.render.objectBounds(compass);
    compass.x += Math.min(0, frame.x + frame.w - 14 - (cb.x + cb.w));
    compass.y += Math.max(0, frame.y + 14 - cb.y);

    doc.objects = blocks.map((b) => b.obj).concat(roads.map((r) => r.obj), markers, [compass]);

    // Fundo: prédios, praças, água e trilhos, desenhados a partir dos dados
    const ps = Math.min(2, 5000 / Ew, 5000 / Eh);
    const s = ps * k;
    const matrix = [s * cs, s * sn, -s * sn, s * cs, s * (-cs * c0.x + sn * c0.y - E.x), s * (-sn * c0.x - cs * c0.y - E.y)];
    const canvas = VM.renderBase(tiles, matrix, Math.round(Ew * ps), Math.round(Eh * ps));
    doc.base = Object.assign({}, doc.base, { width: Ew, height: Eh, visible: true, opacity: 1, grayscale: false, attribution: VM.ATTRIBUTION });
    progress(1);
    return { doc, canvas, stats: { blocks: blocks.length, roads: new Set(roads.map((r) => r.obj.name).filter(Boolean)).size, markers: markers.length } };
  }

  /* ---------- Janela de seleção ---------- */

  async function open() {
    const prefs = App.storage.getPrefs();
    const icon = App.ui.icon;
    const curPreset = (App.store.doc && App.store.doc.frame.preset) || 'card';
    const body = document.createElement('div');
    body.className = 'tz';
    body.innerHTML =
      App.osm.searchHtml() +
      '<div class="osm-map-wrap tz-map"><div class="osm-map"></div>' +
      '<div class="tz-status" role="status"></div>' +
      '<div class="tz-tools">' +
      '<button class="btn small" type="button" data-lasso title="Desenhe com o dedo ou o mouse em volta das quadras">' + icon('area') + '<span>Contornar</span></button>' +
      '<button class="btn small" type="button" data-undo title="Desmarcar a última quadra" disabled>' + icon('undo') + '</button>' +
      '<button class="btn small" type="button" data-clear title="Limpar seleção" disabled>' + icon('trash') + '</button>' +
      '</div><svg class="tz-lasso" hidden><path /></svg></div>' +
      '<div class="tz-options">' +
      '<label class="tz-field tz-grow"><span>Nome do território</span><input class="input" name="tname" placeholder="Ex.: Território 12 · Vila Nova" autocomplete="off" /></label>' +
      '<label class="tz-field"><span>Formato</span><select class="select" name="preset">' + Object.keys(M.FRAMES).map((k) => '<option value="' + k + '"' + (k === curPreset ? ' selected' : '') + '>' + M.FRAMES[k].label + '</option>').join('') + '</select></label>' +
      '<label class="tz-field"><span>Orientação</span><select class="select" name="orient"><option value="north">Norte para cima</option><option value="fit">Girar para caber melhor</option></select></label>' +
      '<label class="tz-check"><input type="checkbox" name="pois" checked /> Pontos de referência</label>' +
      '</div>' +
      '<div class="osm-progress" hidden><div></div></div>';

    const m = App.ui.modal({ title: 'Criar cartão pelo mapa', body, className: 'osm-dialog' });
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancelar';
    cancel.onclick = () => m.close();
    const go = document.createElement('button');
    go.className = 'btn primary';
    go.disabled = true;
    m.foot.append(cancel, go);

    const mapEl = body.querySelector('.osm-map');
    const statusEl = body.querySelector('.tz-status');
    const progress = body.querySelector('.osm-progress');
    const lassoBtn = body.querySelector('[data-lasso]');
    const undoBtn = body.querySelector('[data-undo]');
    const clearBtn = body.querySelector('[data-clear]');
    const lassoSvg = body.querySelector('.tz-lasso');
    const status = (html, kind) => { statusEl.innerHTML = html; statusEl.dataset.kind = kind || ''; statusEl.hidden = !html; };

    let L;
    try { L = await App.osm.loadLeaflet(); }
    catch (e) {
      mapEl.innerHTML = '<div class="empty" style="padding-top:80px">' + icon('globe') + '<strong>Sem conexão</strong><p>Criar pelo mapa precisa de internet. Você ainda pode usar um print ou desenhar em branco.</p></div>';
      return;
    }
    if (!document.body.contains(m.dlg)) return;

    const view = prefs.osmView || { lat: -15.78, lng: -47.93, z: 4 };
    const map = L.map(mapEl, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView([view.lat, view.lng], Math.max(view.z, 4));
    const src = App.osm.SOURCES.osm;
    L.tileLayer(src.url, { maxZoom: src.maxZoom, attribution: src.attribution + ' · quadras: OpenFreeMap' }).addTo(map);
    map.createPane('tzSel').style.zIndex = 450;
    const faceRenderer = L.canvas({ padding: 0.3 });
    const selRenderer = L.svg({ pane: 'tzSel' });
    const facesLayer = L.layerGroup().addTo(map);
    const selLayer = L.layerGroup().addTo(map);
    App.osm.bindSearch(body, map, 17);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl);
    m.dlg.addEventListener('close', () => { ro.disconnect(); map.remove(); });

    const ll = (p) => VM.toLatLng(p.x, p.y);
    const sel = [];
    let graph = null;
    let loadToken = 0;

    function updateFoot() {
      const n = sel.length;
      go.disabled = !n;
      go.innerHTML = icon('check') + (n ? 'Criar cartão · ' + n + (n === 1 ? ' quadra' : ' quadras') : 'Criar cartão');
      undoBtn.disabled = clearBtn.disabled = !n;
    }

    function drawSelection() {
      selLayer.clearLayers();
      sel.forEach((s, i) => {
        const poly = L.polygon(s.ring.map(ll), { renderer: selRenderer, pane: 'tzSel', color: BLOCK_STROKE, weight: 2, fillColor: BLOCK_FILL, fillOpacity: 0.6, dashArray: s.free ? '6 4' : null });
        poly.on('click', (e) => { L.DomEvent.stop(e); sel.splice(i, 1); refresh(); });
        selLayer.addLayer(poly);
        selLayer.addLayer(L.marker(ll(s.lp), { pane: 'tzSel', interactive: false, keyboard: false, icon: L.divIcon({ className: 'tz-num', html: String(i + 1), iconSize: [26, 26] }) }));
      });
      updateFoot();
    }

    function drawFaces() {
      facesLayer.clearLayers();
      if (!graph || map.getZoom() < MIN_ZOOM) return;
      const b = map.getBounds().pad(0.15);
      graph.faces.forEach((f) => {
        if (sel.some((s) => sameFace(s, f))) return;
        const [lat, lng] = ll(f.lp);
        if (!b.contains([lat, lng])) return;
        const poly = L.polygon(f.pts.map(ll), { renderer: faceRenderer, color: '#1f3b6e', weight: 1.5, opacity: 0.6, fillColor: '#2f5fb3', fillOpacity: 0.1 });
        poly.on('mouseover', () => poly.setStyle({ fillOpacity: 0.3 }));
        poly.on('mouseout', () => poly.setStyle({ fillOpacity: 0.1 }));
        poly.on('click', () => {
          sel.push({ ring: f.pts, lp: f.lp, m2: f.m2 });
          refresh();
        });
        facesLayer.addLayer(poly);
      });
    }

    function refresh() { drawSelection(); drawFaces(); idleStatus(); }

    function idleStatus() {
      if (map.getZoom() < MIN_ZOOM) { status('Busque o endereço e aproxime o mapa até aparecerem as quadras.'); return; }
      if (!graph) return;
      if (!graph.faces.length) { status('Não há quadras mapeadas aqui. Use <b>Contornar</b> para desenhar a área do território.', 'warn'); return; }
      status(sel.length ? 'Toque em mais quadras ou em uma marcada para desmarcar. A numeração segue a ordem dos toques.' : 'Toque nas quadras do território, na ordem em que quer numerá-las.');
    }

    async function loadData() {
      if (map.getZoom() < MIN_ZOOM) { graph = null; drawFaces(); idleStatus(); return; }
      const b = map.getBounds().pad(0.2);
      const nw = VM.toG(b.getNorth(), b.getWest()), se = VM.toG(b.getSouth(), b.getEast());
      const list = VM.tilesFor({ x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y });
      if (list.length > 9) { status('Aproxime mais o mapa para carregar as quadras.'); return; }
      const token = ++loadToken;
      status('Carregando quadras…', 'busy');
      try {
        const tiles = await VM.loadTiles(list);
        if (token !== loadToken || !document.body.contains(m.dlg)) return;
        graph = VM.buildGraph(tiles);
        // Mantém as quadras marcadas alinhadas à malha recém-calculada
        sel.forEach((s) => {
          if (s.free) return;
          const f = graph.faces.find((face) => sameFace(s, face));
          if (f) Object.assign(s, { ring: f.pts, lp: f.lp, m2: f.m2 });
        });
        refresh();
      } catch (err) {
        if (token !== loadToken) return;
        console.error(err);
        status('Não foi possível carregar as quadras. Verifique a conexão e mova o mapa para tentar de novo.', 'warn');
      }
    }
    const scheduleLoad = U.debounce(loadData, 350);
    map.on('moveend', scheduleLoad);
    loadData();
    updateFoot();

    undoBtn.addEventListener('click', () => { sel.pop(); refresh(); });
    clearBtn.addEventListener('click', () => { sel.length = 0; refresh(); });

    // Contornar: desenha uma linha livre em volta das quadras.
    let lasso = null;
    const path = lassoSvg.querySelector('path');
    const lassoOn = () => !lassoSvg.hasAttribute('hidden');
    const setLasso = (on) => {
      lassoSvg.toggleAttribute('hidden', !on); // <svg> não tem a propriedade .hidden
      lassoBtn.classList.toggle('active', on);
      if (on) { map.dragging.disable(); status('Desenhe em volta das quadras do território.'); }
      else { map.dragging.enable(); idleStatus(); }
    };
    lassoBtn.addEventListener('click', () => setLasso(!lassoOn()));
    lassoSvg.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { lassoSvg.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
      lasso = [];
      const r = lassoSvg.getBoundingClientRect();
      lasso.push([e.clientX - r.left, e.clientY - r.top]);
    });
    lassoSvg.addEventListener('pointermove', (e) => {
      if (!lasso) return;
      const r = lassoSvg.getBoundingClientRect();
      const p = [e.clientX - r.left, e.clientY - r.top];
      const last = lasso[lasso.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3) return;
      lasso.push(p);
      path.setAttribute('d', 'M' + lasso.map((q) => q.join(',')).join('L') + 'Z');
    });
    const endLasso = () => {
      if (!lasso) return;
      const pts = lasso;
      lasso = null;
      path.setAttribute('d', '');
      setLasso(false);
      if (pts.length < 6) return;
      const ring = pts.map(([x, y]) => { const q = map.containerPointToLatLng([x, y]); return VM.toG(q.lat, q.lng); });
      const found = graph ? graph.faces.filter((f) => U.pointInPolygon(f.lp, ring) && !sel.some((s) => sameFace(s, f))) : [];
      if (found.length) {
        // Numera em sequência, partindo do ponto onde o contorno começou
        let cur = ring[0];
        const rest = found.slice();
        while (rest.length) {
          let bi = 0;
          rest.forEach((f, i) => { if (U.dist(f.lp, cur) < U.dist(rest[bi].lp, cur)) bi = i; });
          const f = rest.splice(bi, 1)[0];
          sel.push({ ring: f.pts, lp: f.lp, m2: f.m2 });
          cur = f.lp;
        }
        App.ui.toast(found.length + (found.length === 1 ? ' quadra marcada.' : ' quadras marcadas.'), { type: 'ok' });
      } else {
        const mpu = VM.metersPerUnit(ring[0].y);
        const free = simplify(ring.concat([ring[0]]), 2).slice(0, -1);
        const m2 = ringArea(free) * mpu * mpu;
        if (m2 < 300) return;
        sel.push({ ring: free, lp: U.polygonLabelPoint(free), m2, free: true });
        App.ui.toast('Área desenhada adicionada ao território.', { type: 'ok' });
      }
      refresh();
    };
    lassoSvg.addEventListener('pointerup', endLasso);
    lassoSvg.addEventListener('pointercancel', endLasso);

    go.addEventListener('click', async () => {
      if (!sel.length) return;
      go.disabled = true;
      cancel.disabled = true;
      progress.hidden = false;
      const bar = progress.firstElementChild;
      const opts = {
        name: body.querySelector('[name=tname]').value.trim(),
        preset: body.querySelector('[name=preset]').value,
        orient: body.querySelector('[name=orient]').value,
        pois: body.querySelector('[name=pois]').checked
      };
      try {
        const out = await build(sel, opts, (p) => { bar.style.width = Math.round(p * 100) + '%'; });
        const c = map.getCenter();
        App.storage.setPrefs({ osmView: { lat: c.lat, lng: c.lng, z: map.getZoom() } });
        m.close();
        await App.actions.openGenerated(out.doc, out.canvas);
        const st = out.stats;
        App.ui.toast('Cartão criado: ' + st.blocks + (st.blocks === 1 ? ' quadra, ' : ' quadras, ') + st.roads + ' ruas com nome' + (st.markers ? ', ' + st.markers + ' referências' : '') + '. Toque em qualquer item para ajustar.', { type: 'ok', duration: 6000 });
      } catch (err) {
        console.error(err);
        App.ui.toast(err.message || 'Não foi possível criar o cartão.', { type: 'error' });
        go.disabled = false;
        cancel.disabled = false;
        progress.hidden = true;
      }
    });
  }

  App.territory = { open, build };
})();
