/* Dados vetoriais do OpenStreetMap (tiles da OpenFreeMap): ruas com nome,
   quadras calculadas a partir da malha de ruas, pontos de referência e o
   desenho do fundo (prédios, praças e água).

   Coordenadas "G": pixels globais do nível 14 com 4096 unidades por tile
   (≈ 0,6 m por unidade no equador). */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;

  const TILEJSON = 'https://tiles.openfreemap.org/planet';
  const Z = 14;
  const EXT = 4096;
  const WORLD = EXT * Math.pow(2, Z);
  const ATTRIBUTION = 'OpenFreeMap © OpenMapTiles © colaboradores do OpenStreetMap';
  const MAX_CACHE = 16;

  // Classes de rua (esquema OpenMapTiles): largura real aproximada em metros,
  // cores e se delimitam quadras.
  const ROAD = {
    motorway: { rank: 7, m: 16, fill: '#f6c26b', casing: '#b7863a', label: 24 },
    trunk: { rank: 6, m: 14, fill: '#f8cd7c', casing: '#bb8d43', label: 24 },
    primary: { rank: 5, m: 13, fill: '#fbdb93', casing: '#c19a52', label: 23 },
    secondary: { rank: 4, m: 12, fill: '#fdeab6', casing: '#c4ab6b', label: 22 },
    tertiary: { rank: 3, m: 11, fill: '#fff4cf', casing: '#c7b67f', label: 22 },
    minor: { rank: 2, m: 8.5, fill: '#ffffff', casing: '#b4bac4', label: 21 },
    pedestrian: { rank: 1, m: 6, fill: '#f4f1f8', casing: '#b9b2c6', label: 19 },
    service: { rank: 0, m: 5, fill: '#ffffff', casing: '#c6cbd3', label: 17 }
  };
  // Tipos de rua para ajustes em grupo (na aba Mapa) e padrões dos cartões.
  const ROAD_GROUPS = [
    { id: 'avenue', label: 'Avenidas', classes: ['motorway', 'trunk', 'primary'] },
    { id: 'collector', label: 'Ruas principais', classes: ['secondary', 'tertiary'] },
    { id: 'street', label: 'Ruas', classes: ['minor'] },
    { id: 'small', label: 'Vielas e acessos', classes: ['pedestrian', 'service'] },
    { id: 'manual', label: 'Desenhadas à mão', classes: [] }
  ];
  // Classe de uma rua gerada (cartões antigos: deduzida pelas cores originais).
  function roadClassOf(o) {
    if (o.roadClass) return o.roadClass;
    if (o.role !== 'street') return null;
    return Object.keys(ROAD).find((k) => ROAD[k].fill === o.color && ROAD[k].casing === o.casingColor) || 'minor';
  }
  const roadGroupOf = (o) => { const c = roadClassOf(o); return c ? ROAD_GROUPS.find((g) => g.classes.includes(c)).id : 'manual'; };
  // Largura "natural" da classe na escala do cartão (kpm = unidades por metro).
  const roadWidth = (cls, kpm) => Math.round(U.clamp(ROAD[cls].m * kpm, ROAD[cls].m * 0.95, ROAD[cls].m * 4) * 10) / 10;

  const BLOCK_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'pedestrian']);

  // Pontos de referência úteis num cartão de território.
  const POI = {
    place_of_worship: { icon: 'church', color: '#7c3aed', prio: 5 },
    school: { icon: 'school', color: '#2563eb', prio: 5 },
    college: { icon: 'school', color: '#2563eb', prio: 4 },
    kindergarten: { icon: 'school', color: '#2563eb', prio: 3 },
    hospital: { icon: 'health', color: '#dc2626', prio: 5 },
    doctors: { icon: 'health', color: '#dc2626', prio: 2 },
    pharmacy: { icon: 'health', color: '#dc2626', prio: 3 },
    grocery: { icon: 'shop', color: '#ea580c', prio: 3, sub: ['supermarket'] },
    shop: { icon: 'shop', color: '#ea580c', prio: 3, sub: ['mall', 'department_store', 'supermarket'] },
    park: { icon: 'park', color: '#16a34a', prio: 4 },
    playground: { icon: 'park', color: '#16a34a', prio: 2 },
    sports_centre: { icon: 'park', color: '#16a34a', prio: 2 },
    stadium: { icon: 'park', color: '#16a34a', prio: 3 },
    police: { icon: 'building', color: '#475569', prio: 3 },
    fire_station: { icon: 'building', color: '#475569', prio: 3 },
    town_hall: { icon: 'building', color: '#475569', prio: 4 },
    post: { icon: 'building', color: '#475569', prio: 2 },
    library: { icon: 'building', color: '#475569', prio: 2 },
    bank: { icon: 'star', color: '#0f766e', prio: 2 },
    fuel: { icon: 'star', color: '#0f766e', prio: 2 },
    bus: { icon: 'bus', color: '#0891b2', prio: 2, sub: ['bus_station'] },
    marketplace: { icon: 'shop', color: '#ea580c', prio: 3 }
  };

  /* ---------- Coordenadas ---------- */

  function toG(lat, lng) {
    const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
    return { x: ((lng + 180) / 360) * WORLD, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD };
  }

  function toLatLng(x, y) {
    const n = Math.PI - (2 * Math.PI * y) / WORLD;
    return [(180 / Math.PI) * Math.atan(Math.sinh(n)), (x / WORLD) * 360 - 180];
  }

  function metersPerUnit(y) {
    const lat = toLatLng(0, y)[0];
    return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / WORLD;
  }

  function tilesFor(rect) {
    const out = [];
    const x1 = Math.floor(rect.x / EXT), x2 = Math.floor((rect.x + rect.w) / EXT);
    const y1 = Math.floor(rect.y / EXT), y2 = Math.floor((rect.y + rect.h) / EXT);
    for (let tx = x1; tx <= x2; tx++) for (let ty = y1; ty <= y2; ty++) out.push({ tx, ty, key: tx + '/' + ty });
    return out;
  }

  /* ---------- Download e leitura dos tiles ---------- */

  let templatePromise = null;
  function tileTemplate() {
    if (!templatePromise) {
      templatePromise = fetch(TILEJSON)
        .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then((j) => j.tiles[0])
        .catch((e) => { templatePromise = null; throw e; });
    }
    return templatePromise;
  }

  const cache = new Map();

  function loadTile(t) {
    if (cache.has(t.key)) {
      const hit = cache.get(t.key);
      cache.delete(t.key);
      cache.set(t.key, hit); // mais recente no fim
      return hit;
    }
    const p = tileTemplate()
      .then((tpl) => fetch(tpl.replace('{z}', Z).replace('{x}', t.tx).replace('{y}', t.ty)))
      .then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
      .then((buf) => processTile(t, App.mvt.decode(buf)))
      .catch((e) => { cache.delete(t.key); throw e; });
    cache.set(t.key, p);
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return p;
  }

  function loadTiles(list) {
    return Promise.all(list.map(loadTile));
  }

  // Recorta uma linha ao retângulo (Liang–Barsky por segmento).
  function clipLine(pts, r) {
    const out = [];
    let cur = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      let t0 = 0, t1 = 1;
      const dx = b.x - a.x, dy = b.y - a.y;
      const edges = [[-dx, a.x - r.x], [dx, r.x + r.w - a.x], [-dy, a.y - r.y], [dy, r.y + r.h - a.y]];
      let ok = true;
      for (const [p, q] of edges) {
        if (p === 0) { if (q < 0) { ok = false; break; } continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
        else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
      }
      if (!ok) { cur = null; continue; }
      const p0 = { x: a.x + dx * t0, y: a.y + dy * t0 }, p1 = { x: a.x + dx * t1, y: a.y + dy * t1 };
      if (!cur || t0 > 0) { cur = [p0]; out.push(cur); }
      cur.push(p1);
      if (t1 < 1) cur = null;
    }
    return out.filter((l) => l.length > 1);
  }

  function processTile(t, layers) {
    const ox = t.tx * EXT, oy = t.ty * EXT;
    const rect = { x: ox, y: oy, w: EXT, h: EXT };
    const k = (layer) => EXT / (layer.extent || EXT);
    const lines = (f, layer) => f.geom.map((ring) => ring.map(([x, y]) => ({ x: ox + x * k(layer), y: oy + y * k(layer) })));
    const tile = { key: t.key, rect, roads: [], names: [], rail: [], polys: { building: [], green: [], water: [] }, pois: [] };

    const tr = layers.transportation;
    if (tr) tr.features.forEach((f) => {
      if (f.type !== 2) return;
      const p = f.props;
      let cls = p.class;
      if (cls === 'rail' || cls === 'transit') {
        if (!p.brunnel || p.brunnel === 'bridge') lines(f, tr).forEach((l) => tile.rail.push(...clipLine(l, rect)));
        return;
      }
      if (cls === 'path' && (p.subclass === 'pedestrian' || p.subclass === 'living_street')) cls = 'pedestrian';
      if (cls === 'busway') cls = 'minor';
      if (!ROAD[cls]) return;
      if (p.brunnel === 'tunnel') return;
      lines(f, tr).forEach((l) => clipLine(l, rect).forEach((pts) => tile.roads.push({ cls, bridge: p.brunnel === 'bridge' || p.brunnel === 'ford' ? true : false, pts })));
    });

    const tn = layers.transportation_name;
    if (tn) tn.features.forEach((f) => {
      if (f.type !== 2 || !f.props.name) return;
      lines(f, tn).forEach((l) => clipLine(l, rect).forEach((pts) => tile.names.push({ name: f.props.name, pts })));
    });

    const poly = (layerName, target, filter) => {
      const L = layers[layerName];
      if (!L) return;
      L.features.forEach((f) => {
        if (f.type !== 3 || (filter && !filter(f.props))) return;
        tile.polys[target].push(lines(f, L));
      });
    };
    poly('building', 'building');
    poly('water', 'water', (p) => p.class !== 'swimming_pool');
    poly('park', 'green');
    poly('landcover', 'green', (p) => ['grass', 'wood', 'park', 'garden', 'recreation_ground'].includes(p.class) || ['park', 'garden', 'grass', 'meadow', 'wood', 'forest', 'recreation_ground', 'village_green'].includes(p.subclass));
    poly('landuse', 'green', (p) => p.class === 'cemetery' || p.class === 'park' || p.class === 'stadium' || p.class === 'pitch');

    const pl = layers.poi;
    if (pl) pl.features.forEach((f) => {
      if (f.type !== 1 || !f.props.name || !f.geom.length) return;
      const def = POI[f.props.class];
      if (!def || (def.sub && !def.sub.includes(f.props.subclass))) return;
      const [x, y] = f.geom[0];
      const px = ox + x * k(pl), py = oy + y * k(pl);
      if (px < ox || px >= ox + EXT || py < oy || py >= oy + EXT) return;
      tile.pois.push({ x: px, y: py, cls: f.props.class, name: String(f.props.name), rank: f.props.rank || 99 });
    });
    return tile;
  }

  /* ---------- Malha de ruas e quadras ---------- */

  const TOL = 1.2; // ≈ 0,7 m: pontas mais próximas que isso viram o mesmo nó

  function buildGraph(tiles) {
    // 1. Segmentos de todas as ruas
    const segs = [];
    tiles.forEach((t) => t.roads.forEach((r) => {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        if (a.x === b.x && a.y === b.y) continue;
        segs.push({ a, b, cls: r.cls, bridge: r.bridge, cuts: [] });
      }
    }));

    // 2. Índice em grade e cruzamentos (pontes só se ligam pelas pontas)
    const CELL = 96;
    const grid = new Map();
    segs.forEach((s, i) => {
      const x1 = Math.floor((Math.min(s.a.x, s.b.x) - TOL) / CELL), x2 = Math.floor((Math.max(s.a.x, s.b.x) + TOL) / CELL);
      const y1 = Math.floor((Math.min(s.a.y, s.b.y) - TOL) / CELL), y2 = Math.floor((Math.max(s.a.y, s.b.y) + TOL) / CELL);
      for (let cx = x1; cx <= x2; cx++) for (let cy = y1; cy <= y2; cy++) {
        const key = cx * 100003 + cy;
        let list = grid.get(key);
        if (!list) grid.set(key, (list = []));
        list.push(i);
      }
    });
    const seen = new Set();
    const touch = (p, s, other) => {
      const r = U.projectOnSegment(p, s.a, s.b);
      if (r.d <= TOL && r.t > 1e-6 && r.t < 1 - 1e-6) s.cuts.push({ t: r.t, p: { x: r.x, y: r.y } });
    };
    grid.forEach((list) => {
      for (let m = 0; m < list.length; m++) {
        for (let n = m + 1; n < list.length; n++) {
          const i = list[m], j = list[n];
          const pk = i < j ? i * 1e6 + j : j * 1e6 + i;
          if (seen.has(pk)) continue;
          seen.add(pk);
          const A = segs[i], B = segs[j];
          if (Math.max(A.a.x, A.b.x) + TOL < Math.min(B.a.x, B.b.x) || Math.max(B.a.x, B.b.x) + TOL < Math.min(A.a.x, A.b.x)) continue;
          if (Math.max(A.a.y, A.b.y) + TOL < Math.min(B.a.y, B.b.y) || Math.max(B.a.y, B.b.y) + TOL < Math.min(A.a.y, A.b.y)) continue;
          if (!A.bridge && !B.bridge) {
            const rx = A.b.x - A.a.x, ry = A.b.y - A.a.y, sx = B.b.x - B.a.x, sy = B.b.y - B.a.y;
            const den = rx * sy - ry * sx;
            if (Math.abs(den) > 1e-9) {
              const qx = B.a.x - A.a.x, qy = B.a.y - A.a.y;
              const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
              if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
                const p = { x: A.a.x + rx * t, y: A.a.y + ry * t };
                A.cuts.push({ t, p });
                B.cuts.push({ t: u, p });
                continue;
              }
            }
          }
          touch(A.a, B); touch(A.b, B); touch(B.a, A); touch(B.b, A);
        }
      }
    });

    // 3. Nós (com junção de pontas muito próximas) e arestas
    const nodes = [];
    const ngrid = new Map();
    const nodeAt = (p) => {
      const cx = Math.floor(p.x / TOL), cy = Math.floor(p.y / TOL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const list = ngrid.get((cx + dx) * 1e7 + (cy + dy));
        if (list) for (const id of list) if (Math.abs(nodes[id].x - p.x) <= TOL && Math.abs(nodes[id].y - p.y) <= TOL) return id;
      }
      const id = nodes.length;
      nodes.push({ x: p.x, y: p.y });
      const key = cx * 1e7 + cy;
      if (!ngrid.has(key)) ngrid.set(key, []);
      ngrid.get(key).push(id);
      return id;
    };
    const edgeMap = new Map();
    const edges = [];
    segs.forEach((s) => {
      const pts = [s.a].concat(s.cuts.sort((m, n) => m.t - n.t).map((c) => c.p), [s.b]);
      let prev = nodeAt(pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const id = nodeAt(pts[i]);
        if (id === prev) continue;
        const key = prev < id ? prev + '_' + id : id + '_' + prev;
        const old = edgeMap.get(key);
        if (old) {
          if (ROAD[s.cls].rank > ROAD[old.cls].rank) old.cls = s.cls;
          if (!s.bridge) old.bridge = false;
        } else {
          const e = { u: prev, v: id, cls: s.cls, bridge: s.bridge, name: '' };
          edgeMap.set(key, e);
          edges.push(e);
        }
        prev = id;
      }
    });

    assignNames(tiles, nodes, edges);
    const faces = findFaces(nodes, edges);
    return { nodes, edges, faces };
  }

  // Os nomes vêm numa camada separada: cada trecho recebe o nome da linha
  // nomeada mais próxima e paralela a ele.
  function assignNames(tiles, nodes, edges) {
    const CELL = 48;
    const grid = new Map();
    const segs = [];
    tiles.forEach((t) => t.names.forEach((l) => {
      for (let i = 0; i < l.pts.length - 1; i++) {
        const s = { a: l.pts[i], b: l.pts[i + 1], name: l.name };
        const idx = segs.push(s) - 1;
        const x1 = Math.floor(Math.min(s.a.x, s.b.x) / CELL), x2 = Math.floor(Math.max(s.a.x, s.b.x) / CELL);
        const y1 = Math.floor(Math.min(s.a.y, s.b.y) / CELL), y2 = Math.floor(Math.max(s.a.y, s.b.y) / CELL);
        for (let cx = x1; cx <= x2; cx++) for (let cy = y1; cy <= y2; cy++) {
          const key = cx * 100003 + cy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(idx);
        }
      }
    }));
    edges.forEach((e) => {
      const a = nodes[e.u], b = nodes[e.v];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const cx = Math.floor(mid.x / CELL), cy = Math.floor(mid.y / CELL);
      let best = null, bestD = 6;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get((cx + dx) * 100003 + (cy + dy));
        if (!list) continue;
        for (const idx of list) {
          const s = segs[idx];
          const sl = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) || 1;
          const dot = Math.abs(((s.b.x - s.a.x) * ux + (s.b.y - s.a.y) * uy) / sl);
          if (dot < 0.86 && len > 6) continue;
          const d = U.projectOnSegment(mid, s.a, s.b).d;
          if (d < bestD) { bestD = d; best = s; }
        }
      }
      if (best) e.name = best.name;
    });
    // Trechos que ficaram sem nome herdam o da continuação (mesma classe,
    // ponto sem cruzamento), comum quando a rua é cortada em vários trechos.
    const inc = new Map();
    edges.forEach((e, i) => [e.u, e.v].forEach((n) => { if (!inc.has(n)) inc.set(n, []); inc.get(n).push(i); }));
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      edges.forEach((e, i) => {
        if (e.name) return;
        for (const n of [e.u, e.v]) {
          const list = inc.get(n);
          if (list.length !== 2) continue;
          const f = edges[list[0] === i ? list[1] : list[0]];
          if (f.name && f.cls === e.cls) { e.name = f.name; changed = true; return; }
        }
      });
      if (!changed) break;
    }
  }

  // Faces da malha planar = quadras. Pontas soltas (ruas sem saída) são
  // removidas antes; cada face interna é percorrida virando sempre para o
  // mesmo lado.
  function findFaces(nodes, edges) {
    const adj = nodes.map(() => []);
    edges.forEach((e, i) => {
      if (!BLOCK_CLASSES.has(e.cls) || e.bridge) return;
      adj[e.u].push(e.v);
      adj[e.v].push(e.u);
    });
    const deg = adj.map((l) => l.length);
    const alive = adj.map(() => true);
    const stack = [];
    deg.forEach((d, i) => { if (d < 2) stack.push(i); });
    while (stack.length) {
      const i = stack.pop();
      if (!alive[i]) continue;
      alive[i] = false;
      adj[i].forEach((j) => { if (alive[j] && --deg[j] < 2) stack.push(j); });
    }
    const nb = adj.map((list, i) => {
      if (!alive[i]) return [];
      const p = nodes[i];
      return list.filter((j) => alive[j]).map((j) => ({ j, a: Math.atan2(nodes[j].y - p.y, nodes[j].x - p.x) })).sort((m, n) => m.a - n.a).map((o) => o.j);
    });
    const used = new Set();
    const faces = [];
    const mpu = nodes.length ? metersPerUnit(nodes[0].y) : 1;
    for (let u = 0; u < nb.length; u++) {
      for (const v0 of nb[u]) {
        if (used.has(u * 1e7 + v0)) continue;
        const ring = [];
        let a = u, b = v0, guard = 0, ok = false;
        while (guard++ < 5000) {
          const key = a * 1e7 + b;
          if (used.has(key)) break;
          used.add(key);
          ring.push(a);
          const list = nb[b];
          const c = list[(list.indexOf(a) + 1) % list.length];
          a = b; b = c;
          if (a === u && b === v0) { ok = true; break; }
        }
        if (!ok || ring.length < 3) continue;
        const pts = ring.map((id) => nodes[id]);
        let area = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j].x * pts[i].y - pts[i].x * pts[j].y);
        area /= -2; // faces internas saem em sentido horário (y para baixo)
        const m2 = area * mpu * mpu;
        if (m2 < 120 || m2 > 600000) continue;
        // Canteiros entre pistas e rotatórias estreitas não são quadras
        let per = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) per += Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if ((2 * area) / per * mpu < 15) continue;
        const lp = U.polygonLabelPoint(pts);
        faces.push({ nodes: ring, pts, area, m2, lp, bbox: U.bounds(pts) });
      }
    }
    return faces;
  }

  /* ---------- Fundo do mapa (prédios, praças, água, trilhos) ---------- */

  // m: matriz [a, b, c, d, e, f] de G para pixels do fundo.
  function renderBase(tiles, m, W, H) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    c.fillStyle = '#efede8';
    c.fillRect(0, 0, W, H);
    const scale = Math.hypot(m[0], m[1]);
    const px = (n) => n / scale; // espessura em pixels → unidades G
    const fillPolys = (list, fill, stroke, sw) => {
      c.beginPath();
      list.forEach((rings) => rings.forEach((ring) => {
        ring.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.closePath();
      }));
      c.fillStyle = fill;
      c.fill('evenodd');
      if (stroke) { c.lineWidth = px(sw); c.strokeStyle = stroke; c.stroke(); }
    };
    tiles.forEach((t) => {
      c.save();
      c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      c.beginPath();
      c.rect(t.rect.x, t.rect.y, t.rect.w, t.rect.h);
      c.clip();
      fillPolys(t.polys.green, '#d5e8c9', null);
      fillPolys(t.polys.water, '#aed3e3', null);
      fillPolys(t.polys.building, '#e0dcd3', '#d2cdc2', Math.max(0.6, W / 2400));
      c.restore();
    });
    // Trilhos por cima, sem recorte (linhas já recortadas por tile)
    c.save();
    c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    c.lineCap = 'butt';
    tiles.forEach((t) => t.rail.forEach((l) => {
      c.beginPath();
      l.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.lineWidth = px(Math.max(2, W / 700));
      c.strokeStyle = '#9aa0a8';
      c.setLineDash([]);
      c.stroke();
      c.lineWidth = px(Math.max(1, W / 1400));
      c.strokeStyle = '#ffffff';
      c.setLineDash([px(Math.max(4, W / 220)), px(Math.max(4, W / 220))]);
      c.stroke();
    }));
    c.restore();
    return canvas;
  }

  App.vectormap = { Z, EXT, WORLD, ATTRIBUTION, ROAD, ROAD_GROUPS, roadClassOf, roadGroupOf, roadWidth, POI, BLOCK_CLASSES, toG, toLatLng, metersPerUnit, tilesFor, loadTiles, buildGraph, renderBase, clipLine };
})();
