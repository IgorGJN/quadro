/* Editor: visualização, ferramentas, gestos (mouse, toque, caneta) e teclado. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;
  const S = App.store;
  const R = App.render;

  const ACCENT = '#2f5fb3';
  const JUNCTION = '#16a34a';
  const DRAW_TOOLS = ['road', 'area'];

  const E = {
    canvas: null, ctx: null, stage: null, dpr: 1,
    view: { scale: 1, ox: 0, oy: 0 },
    tool: 'select',
    draft: null,
    hover: null,
    hoverId: null,
    snap: null,
    mergeTarget: null,
    focusDraft: null,
    gesture: null,
    pointers: new Map(),
    ignorePointers: false,
    pointerType: 'mouse',
    spaceDown: false,
    altDown: false,
    busy: false,
    drawQueued: false,
    stageColor: '#d9dee7'
  };

  /* ---------- Coordenadas e visualização ---------- */

  const toWorld = (sx, sy) => ({ x: (sx - E.view.ox) / E.view.scale, y: (sy - E.view.oy) / E.view.scale });
  const toScreen = (p) => ({ x: p.x * E.view.scale + E.view.ox, y: p.y * E.view.scale + E.view.oy });
  const px = (n) => n / E.view.scale; // pixels de tela → unidades do mapa
  const touchy = () => E.pointerType !== 'mouse';
  const tolPx = () => (touchy() ? 18 : 9);

  function size() {
    const r = E.stage.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  function fitScale(rect) {
    const s = size();
    const pad = Math.max(24, Math.min(s.w, s.h) * 0.06);
    return Math.min((s.w - pad * 2) / rect.w, (s.h - pad * 2) / rect.h);
  }

  function zoomToRect(rect) {
    const s = size();
    E.lastSize = s;
    const k = U.clamp(fitScale(rect), 1e-4, 1e4);
    E.view.scale = k;
    E.view.ox = s.w / 2 - (rect.x + rect.w / 2) * k;
    E.view.oy = s.h / 2 - (rect.y + rect.h / 2) * k;
    requestDraw();
    updateZoomLabel();
  }

  function fitFrame() { zoomToRect(S.doc.frame); }

  function zoomAt(sx, sy, factor) {
    const base = fitScale(S.doc.frame);
    const next = U.clamp(E.view.scale * factor, base * 0.08, base * 60);
    const w = toWorld(sx, sy);
    E.view.scale = next;
    E.view.ox = sx - w.x * next;
    E.view.oy = sy - w.y * next;
    requestDraw();
    updateZoomLabel();
  }

  function zoomBy(factor) { const s = size(); zoomAt(s.w / 2, s.h / 2, factor); }

  function updateZoomLabel() {
    const el = document.getElementById('zoomValue');
    if (el) el.textContent = Math.round((E.view.scale / fitScale(S.doc.frame)) * 100) + '%';
  }

  function visibleWorld() {
    const s = size();
    const a = toWorld(0, 0), b = toWorld(s.w, s.h);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  function resize() {
    if (!E.canvas) return;
    const s = size();
    const prevCenter = E.lastSize ? toWorld(E.lastSize.w / 2, E.lastSize.h / 2) : null;
    E.dpr = Math.min(window.devicePixelRatio || 1, 3);
    E.canvas.width = Math.round(s.w * E.dpr);
    E.canvas.height = Math.round(s.h * E.dpr);
    if (prevCenter) {
      E.view.ox = s.w / 2 - prevCenter.x * E.view.scale;
      E.view.oy = s.h / 2 - prevCenter.y * E.view.scale;
    }
    E.lastSize = s;
    readTheme();
    draw();
    updateZoomLabel();
  }

  function readTheme() {
    E.stageColor = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#d9dee7';
  }

  /* ---------- Desenho ---------- */

  function requestDraw() {
    if (E.drawQueued) return;
    E.drawQueued = true;
    requestAnimationFrame(() => { E.drawQueued = false; draw(); });
  }

  function draw() {
    const c = E.ctx;
    if (!c || !S.doc) return;
    const s = size();
    const doc = S.doc;
    const f = doc.frame;
    c.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    c.fillStyle = E.stageColor;
    c.fillRect(0, 0, s.w, s.h);

    c.save();
    c.translate(E.view.ox, E.view.oy);
    c.scale(E.view.scale, E.view.scale);
    let paper = f;
    if (doc.base.imageId && doc.base.width) paper = U.rectsUnion(f, { x: 0, y: 0, w: doc.base.width, h: doc.base.height });
    const cover = U.rectsUnion(visibleWorld(), paper);
    // Sombra do "papel"
    c.save();
    c.shadowColor = 'rgba(16,24,40,.18)';
    c.shadowBlur = 18;
    c.shadowOffsetY = 4;
    c.fillStyle = '#ffffff';
    c.fillRect(paper.x, paper.y, paper.w, paper.h);
    c.restore();

    R.drawScene(c, doc, { cover, paper });
    if (E.focusDraft) R.drawFocus(c, E.focusDraft, cover, true);
    drawOverlays(c);
    c.restore();

    drawFrameChrome(c, s);
  }

  function drawFrameChrome(c, s) {
    const doc = S.doc;
    const f = doc.frame;
    const a = toScreen(f), b = toScreen({ x: f.x + f.w, y: f.y + f.h });
    if (doc.settings.dimOutside) {
      c.beginPath();
      c.rect(0, 0, s.w, s.h);
      c.rect(a.x, a.y, b.x - a.x, b.y - a.y);
      c.fillStyle = E.tool === 'frame' ? 'rgba(15,23,42,.5)' : 'rgba(15,23,42,.32)';
      c.fill('evenodd');
    }
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(255,255,255,.95)';
    c.strokeRect(a.x - 0.75, a.y - 0.75, b.x - a.x + 1.5, b.y - a.y + 1.5);
    if (E.tool === 'frame') {
      c.setLineDash([6, 5]);
      c.strokeStyle = ACCENT;
      c.lineWidth = 2;
      c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      c.setLineDash([]);
      frameCorners().forEach((p) => {
        const q = toScreen(p);
        c.fillStyle = '#ffffff';
        c.strokeStyle = ACCENT;
        c.lineWidth = 2;
        c.fillRect(q.x - 7, q.y - 7, 14, 14);
        c.strokeRect(q.x - 7, q.y - 7, 14, 14);
      });
    }
    const preset = M.FRAMES[doc.frame.preset] || M.FRAMES.card;
    const label = String(preset.w).replace('.', ',') + ' × ' + String(preset.h).replace('.', ',') + ' cm';
    c.font = '600 11px ' + R.FONT;
    const tw = c.measureText(label).width;
    const ly = a.y - 22 < 4 ? a.y + 6 : a.y - 22;
    c.fillStyle = E.tool === 'frame' ? ACCENT : 'rgba(22,32,58,.72)';
    R.roundRect(c, a.x, ly, tw + 14, 18, 5);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(label, a.x + 7, ly + 9.5);
  }

  function handleCircle(c, p, r, fill, stroke, lw) {
    c.beginPath();
    c.arc(p.x, p.y, px(r), 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = px(lw || 2);
    c.strokeStyle = stroke;
    c.stroke();
  }

  function usageMap() {
    const m = new Map();
    S.doc.objects.forEach((o) => {
      if (!o.points || o.visible === false) return;
      new Set(o.points).forEach((id) => m.set(id, (m.get(id) || 0) + 1));
    });
    return m;
  }

  function drawOverlays(c) {
    const doc = S.doc;
    const sel = S.selected();
    const usage = usageMap();

    // Pontos de encaixe visíveis enquanto desenha
    if (DRAW_TOOLS.includes(E.tool) && doc.settings.showNodes) {
      usage.forEach((n, id) => {
        const p = S.node(id);
        if (!p) return;
        if (n > 1) handleCircle(c, p, 4.5, JUNCTION, '#ffffff', 1.5);
        else handleCircle(c, p, 3, '#ffffff', 'rgba(22,32,58,.55)', 1.2);
      });
    }

    // Destaque ao passar o mouse
    if (E.tool === 'select' && E.hoverId && E.hoverId !== S.sel.id && !E.gesture) {
      const ho = S.get(E.hoverId);
      if (ho) outline(c, ho, 'rgba(47,95,179,.55)', 1.5);
    }

    // Numerar tocando: quadras já numeradas em verde, as que faltam tracejadas
    if (E.tool === 'number' && E.numbering) {
      doc.objects.filter((o) => M.isBlock(o) && o.visible !== false).forEach((o) => {
        const done = E.numbering.done.includes(o.id);
        c.save();
        if (!done) c.setLineDash([px(6), px(4)]);
        outline(c, o, done ? JUNCTION : ACCENT, done ? 3.5 : 2);
        c.restore();
      });
    }

    if (sel && sel.visible !== false && E.tool !== 'number') drawSelection(c, sel, usage);
    if (E.draft) drawDraft(c);

    if (E.snap && (DRAW_TOOLS.includes(E.tool) || E.mergeTarget)) {
      const color = E.snap.kind === 'seg' ? JUNCTION : ACCENT;
      c.beginPath();
      c.arc(E.snap.x, E.snap.y, px(9), 0, Math.PI * 2);
      c.fillStyle = E.snap.kind === 'seg' ? 'rgba(22,163,74,.18)' : 'rgba(47,95,179,.18)';
      c.fill();
      c.lineWidth = px(2);
      c.strokeStyle = color;
      c.stroke();
    }
    if (E.mergeTarget) {
      const p = S.node(E.mergeTarget);
      if (p) { c.beginPath(); c.arc(p.x, p.y, px(13), 0, Math.PI * 2); c.lineWidth = px(3); c.strokeStyle = JUNCTION; c.stroke(); }
    }
  }

  function outline(c, obj, color, lw) {
    c.save();
    c.lineWidth = px(lw);
    c.strokeStyle = color;
    if (obj.points) {
      R.tracePath(c, S.points(obj), obj.type === 'area', obj.smooth);
      c.stroke();
    } else {
      const b = R.objectBounds(obj);
      c.setLineDash([px(5), px(4)]);
      c.strokeRect(b.x - px(4), b.y - px(4), b.w + px(8), b.h + px(8));
    }
    c.restore();
  }

  function drawSelection(c, obj, usage) {
    const locked = obj.locked;
    const col = locked ? '#94a3b8' : ACCENT;
    if (obj.points) {
      c.save();
      c.lineWidth = px(4);
      c.strokeStyle = 'rgba(255,255,255,.9)';
      R.tracePath(c, S.points(obj), obj.type === 'area', obj.smooth);
      c.stroke();
      c.lineWidth = px(2);
      c.strokeStyle = col;
      c.stroke();
      c.restore();
      if (locked) return;
      if (E.tool === 'select') {
        midpoints(obj).forEach((m) => handleCircle(c, m, 4, 'rgba(255,255,255,.85)', 'rgba(47,95,179,.7)', 1.5));
      }
      obj.points.forEach((id) => {
        const p = S.node(id);
        if (!p) return;
        const shared = (usage.get(id) || 0) > 1;
        if (id === S.sel.node) handleCircle(c, p, 7.5, col, '#ffffff', 2.5);
        else handleCircle(c, p, 6, shared ? JUNCTION : '#ffffff', shared ? '#ffffff' : col, 2);
      });
      return;
    }
    const b = R.objectBounds(obj);
    c.save();
    c.lineWidth = px(1.5);
    c.strokeStyle = col;
    c.setLineDash([px(5), px(4)]);
    const m = px(5);
    c.strokeRect(b.x - m, b.y - m, b.w + m * 2, b.h + m * 2);
    c.restore();
    if (locked) return;
    if (obj.type === 'focus') focusCorners(obj).forEach((p) => handleCircle(c, p, 6, '#ffffff', col, 2));
    const rh = rotationHandle(obj);
    if (rh) {
      c.beginPath();
      c.moveTo(rh.base.x, rh.base.y);
      c.lineTo(rh.p.x, rh.p.y);
      c.lineWidth = px(1.5);
      c.strokeStyle = col;
      c.stroke();
      handleCircle(c, rh.p, 6, '#ffffff', col, 2);
    }
  }

  function drawDraft(c) {
    const d = E.draft;
    const pts = d.pts.slice();
    const live = E.hover && !touchy() ? livePoint(E.hover) : null;
    const all = live ? pts.concat([live]) : pts;
    c.save();
    if (d.type === 'area' && all.length > 2) {
      R.tracePath(c, all, true, false);
      c.fillStyle = 'rgba(47,95,179,.12)';
      c.fill();
    }
    const style = S.styleFor(d.type);
    if (d.type === 'road' && pts.length > 1) {
      R.tracePath(c, pts, false, style.smooth);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = style.width;
      c.strokeStyle = U.hexToRgba(style.color, 0.55);
      c.stroke();
    }
    if (all.length > 1) {
      R.tracePath(c, all, false, false);
      c.lineWidth = px(2);
      c.setLineDash([px(7), px(5)]);
      c.strokeStyle = ACCENT;
      c.stroke();
      c.setLineDash([]);
    }
    c.restore();
    pts.forEach((p, i) => {
      const first = i === 0 && d.type === 'area' && pts.length > 2;
      handleCircle(c, p, first ? 8 : 5, first ? ACCENT : '#ffffff', first ? '#ffffff' : ACCENT, 2);
    });
  }

  /* ---------- Alças ---------- */

  function midpoints(obj) {
    const pts = S.points(obj);
    const out = [];
    const n = obj.type === 'area' ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (U.dist(a, b) * E.view.scale < 34) continue;
      out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, seg: i });
    }
    return out;
  }

  function focusCorners(o) {
    return [{ x: o.x, y: o.y, c: 'nw' }, { x: o.x + o.w, y: o.y, c: 'ne' }, { x: o.x + o.w, y: o.y + o.h, c: 'se' }, { x: o.x, y: o.y + o.h, c: 'sw' }];
  }

  function frameCorners() { return focusCorners(S.doc.frame); }

  function rotationHandle(obj) {
    if (obj.type !== 'text' && obj.type !== 'compass') return null;
    const top = obj.type === 'text' ? -R.textBox(obj).h / 2 : -obj.size * 0.95;
    const base = U.rotate({ x: obj.x, y: obj.y + top }, obj.rotation || 0, obj);
    const p = U.rotate({ x: obj.x, y: obj.y + top - px(26) }, obj.rotation || 0, obj);
    return { base, p };
  }

  function handleAt(sp) {
    const obj = S.selected();
    const tol = tolPx() + 2;
    const near = (p) => { const q = toScreen(p); return Math.hypot(q.x - sp.x, q.y - sp.y) <= tol; };
    if (E.tool === 'frame') {
      const c = frameCorners().find(near);
      return c ? { kind: 'frameCorner', corner: c.c } : null;
    }
    if (!obj || obj.locked || obj.visible === false || E.tool !== 'select') return null;
    if (obj.points) {
      // Ponto selecionado primeiro, depois os demais (do mais próximo)
      let best = null, bestD = Infinity;
      obj.points.forEach((id) => {
        const p = S.node(id);
        if (!p) return;
        const q = toScreen(p);
        const d = Math.hypot(q.x - sp.x, q.y - sp.y);
        if (d <= tol && d < bestD) { bestD = d; best = id; }
      });
      if (best) return { kind: 'vertex', nodeId: best };
      const m = midpoints(obj).find(near);
      if (m) return { kind: 'mid', seg: m.seg, x: m.x, y: m.y };
      return null;
    }
    const rh = rotationHandle(obj);
    if (rh && near(rh.p)) return { kind: 'rotate' };
    if (obj.type === 'focus') {
      const c = focusCorners(obj).find(near);
      if (c) return { kind: 'corner', corner: c.c };
    }
    return null;
  }

  /* ---------- Encaixe ---------- */

  function findSnap(wp, opts) {
    const o = opts || {};
    if (!S.doc.settings.snap || E.altDown) return null;
    const tol = px(touchy() ? 20 : 12);
    let best = null, bestD = tol;
    S.doc.objects.forEach((obj) => {
      if (!obj.points || obj.visible === false || obj.locked) return;
      obj.points.forEach((id) => {
        if (o.exclude && o.exclude.has(id)) return;
        const p = S.node(id);
        if (!p) return;
        const d = U.dist(p, wp);
        if (d < bestD) { bestD = d; best = { kind: 'node', nodeId: id, x: p.x, y: p.y }; }
      });
    });
    if (best || o.nodesOnly) return best;
    bestD = tol;
    S.doc.objects.forEach((obj) => {
      if (!obj.points || obj.visible === false || obj.locked) return;
      const pts = S.points(obj);
      const n = obj.type === 'area' ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const r = U.projectOnSegment(wp, pts[i], pts[(i + 1) % pts.length]);
        if (r.t > 0.02 && r.t < 0.98 && r.d < bestD) { bestD = r.d; best = { kind: 'seg', objId: obj.id, x: r.x, y: r.y }; }
      }
    });
    return best;
  }

  function livePoint(wp, shift) {
    const d = E.draft;
    const last = d && d.pts[d.pts.length - 1];
    if ((shift || E.shiftDown) && last) {
      const ang = Math.round(Math.atan2(wp.y - last.y, wp.x - last.x) / (Math.PI / 12)) * (Math.PI / 12);
      const len = U.dist(wp, last);
      E.snap = null;
      return { x: last.x + Math.cos(ang) * len, y: last.y + Math.sin(ang) * len, snap: null };
    }
    const s = findSnap(wp);
    E.snap = s;
    return s ? { x: s.x, y: s.y, snap: s } : { x: wp.x, y: wp.y, snap: null };
  }

  /* ---------- Rascunho de rua/área ---------- */

  function addDraftPoint(wp, sp, shift) {
    if (!E.draft) E.draft = { type: E.tool, pts: [] };
    const d = E.draft;
    const pts = d.pts;
    const nearScreen = (p) => { const q = toScreen(p); return Math.hypot(q.x - sp.x, q.y - sp.y) <= tolPx() + 3; };
    if (d.type === 'area' && pts.length >= 3 && nearScreen(pts[0])) return finishDraft();
    if (pts.length >= (d.type === 'area' ? 3 : 2) && nearScreen(pts[pts.length - 1])) return finishDraft();
    const p = livePoint(wp, shift);
    const last = pts[pts.length - 1];
    if (last && ((p.snap && last.snap && p.snap.nodeId && p.snap.nodeId === last.snap.nodeId) || U.dist(p, last) < px(2))) return;
    pts.push(p);
    updateHint();
    requestDraw();
  }

  function undoDraftPoint() {
    if (!E.draft) return;
    E.draft.pts.pop();
    if (!E.draft.pts.length) E.draft = null;
    updateHint();
    requestDraw();
  }

  function cancelDraft() {
    E.draft = null;
    E.snap = null;
    updateHint();
    requestDraw();
  }

  function finishDraft() {
    const d = E.draft;
    if (!d) return;
    const min = M.MIN_POINTS[d.type];
    if (d.pts.length < min) {
      App.ui.toast(d.type === 'road' ? 'Uma rua precisa de pelo menos 2 pontos.' : 'Uma área precisa de pelo menos 3 pontos.');
      return;
    }
    S.checkpoint();
    const ids = [];
    d.pts.forEach((p) => {
      let id = null;
      if (p.snap && p.snap.kind === 'node' && S.node(p.snap.nodeId)) id = p.snap.nodeId;
      else {
        id = S.newNode(p.x, p.y);
        const target = p.snap && p.snap.kind === 'seg' ? S.get(p.snap.objId) : null;
        if (target) S.insertOnNearestSegment(target, id);
      }
      if (ids[ids.length - 1] !== id) ids.push(id);
    });
    if (d.type === 'area' && ids.length > 1 && ids[0] === ids[ids.length - 1]) ids.pop();
    E.draft = null;
    E.snap = null;
    if (ids.length < min) { S.dropLastCheckpoint(); S.cleanupNodes(); updateHint(); requestDraw(); return; }
    const obj = S.create(d.type, { points: ids }, { skipCheckpoint: true });
    if (d.type === 'road' && S.doc.settings.autoCross) {
      const n = S.crossRoads([obj.id], px(3));
      if (n) { S.changed(); App.ui.toast(n === 1 ? '1 cruzamento virou junção.' : n + ' cruzamentos viraram junções.'); }
    }
    updateHint();
    requestDraw();
  }

  /* ---------- Gestos ---------- */

  function threshold() { return touchy() ? 9 : 4; }

  // Toque curto executa a ação; arrastar move o mapa.
  function tapOrPan(sp0, onTap) {
    let panning = false;
    let last = sp0;
    return {
      move(sp) {
        if (!panning && Math.hypot(sp.x - sp0.x, sp.y - sp0.y) > threshold()) panning = true;
        if (panning) { E.view.ox += sp.x - last.x; E.view.oy += sp.y - last.y; requestDraw(); }
        last = sp;
      },
      up(sp, wp, e) { if (!panning && onTap) onTap(sp, wp, e); },
      cursor: 'grabbing'
    };
  }

  function panGesture(sp0) {
    let last = sp0;
    return {
      move(sp) { E.view.ox += sp.x - last.x; E.view.oy += sp.y - last.y; last = sp; requestDraw(); },
      up() {},
      cursor: 'grabbing'
    };
  }

  function pinchGesture() {
    const [a, b] = Array.from(E.pointers.values());
    const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const c0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s0 = E.view.scale;
    const w0 = toWorld(c0.x, c0.y);
    const base = fitScale(S.doc.frame);
    return {
      pinch: true,
      move() {
        const [p, q] = Array.from(E.pointers.values());
        if (!p || !q) return;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        const c = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        const k = U.clamp((s0 * d) / d0, base * 0.08, base * 60);
        E.view.scale = k;
        E.view.ox = c.x - w0.x * k;
        E.view.oy = c.y - w0.y * k;
        requestDraw();
        updateZoomLabel();
      },
      up() {}
    };
  }

  function moveGesture(obj, sp0, wp0) {
    let started = false;
    let last = wp0;
    return {
      move(sp, wp) {
        if (!started) {
          if (Math.hypot(sp.x - sp0.x, sp.y - sp0.y) <= threshold()) return;
          started = true;
          S.checkpoint();
          E.busy = true;
        }
        S.moveBy(obj, wp.x - last.x, wp.y - last.y);
        last = wp;
        S.changed();
        requestDraw();
      },
      up() { if (started) { E.busy = false; S.changed(); } },
      cursor: 'move'
    };
  }

  // Arrastar o nome de uma rua: ele desliza ao longo da própria rua.
  function labelGesture(obj, sp0) {
    let started = false;
    return {
      move(sp, wp) {
        if (!started) {
          if (Math.hypot(sp.x - sp0.x, sp.y - sp0.y) <= threshold()) return;
          started = true;
          S.checkpoint('label:' + obj.id);
          E.busy = true;
        }
        obj.labelAt = { x: wp.x, y: wp.y };
        S.changed();
        requestDraw();
      },
      up() { if (started) { E.busy = false; S.changed(); } },
      cursor: 'grabbing'
    };
  }

  function vertexGesture(obj, nodeId, sp0, insertSeg) {
    let started = false;
    let id = nodeId;
    return {
      move(sp, wp) {
        if (!started) {
          if (Math.hypot(sp.x - sp0.x, sp.y - sp0.y) <= threshold()) return;
          started = true;
          S.checkpoint();
          E.busy = true;
          if (insertSeg != null) {
            id = S.newNode(wp.x, wp.y);
            S.insertNode(obj, insertSeg, id);
            S.select(obj.id, id);
          }
        }
        // Encaixa em outro ponto (para criar uma junção) ao soltar
        const exclude = new Set([id]);
        const idx = obj.points.indexOf(id);
        if (obj.points[idx - 1]) exclude.add(obj.points[idx - 1]);
        if (obj.points[idx + 1]) exclude.add(obj.points[idx + 1]);
        if (obj.type === 'area') { exclude.add(obj.points[(idx + 1) % obj.points.length]); exclude.add(obj.points[(idx - 1 + obj.points.length) % obj.points.length]); }
        const s = findSnap(wp, { exclude, nodesOnly: true });
        E.mergeTarget = s ? s.nodeId : null;
        E.snap = s;
        const n = S.node(id);
        if (n) { n.x = s ? s.x : wp.x; n.y = s ? s.y : wp.y; }
        S.changed();
        requestDraw();
      },
      up() {
        if (!started) return;
        E.busy = false;
        const target = E.mergeTarget;
        E.mergeTarget = null;
        E.snap = null;
        if (target) {
          if (S.mergeNodes(id, target)) {
            S.select(obj.id, target);
            App.ui.toast('Pontos conectados: agora é uma junção.', { type: 'ok' });
          }
        }
        S.changed();
        requestDraw();
      },
      cursor: 'grabbing'
    };
  }

  function rotateGesture(obj, shift) {
    let started = false;
    return {
      move(sp, wp, e) {
        if (!started) { started = true; S.checkpoint(); E.busy = true; }
        let ang = (Math.atan2(wp.y - obj.y, wp.x - obj.x) * 180) / Math.PI + 90;
        if (e.shiftKey || shift) ang = Math.round(ang / 15) * 15;
        else if (Math.abs(Math.round(ang / 90) * 90 - ang) < 3) ang = Math.round(ang / 90) * 90;
        if (ang > 180) ang -= 360;
        obj.rotation = Math.round(ang);
        S.changed();
        requestDraw();
      },
      up() { if (started) { E.busy = false; S.changed(); } },
      cursor: 'grabbing'
    };
  }

  function rectResize(rect, corner, wp, ratio) {
    const ax = corner.includes('w') ? rect.x + rect.w : rect.x;
    const ay = corner.includes('n') ? rect.y + rect.h : rect.y;
    let w = Math.abs(wp.x - ax), h = Math.abs(wp.y - ay);
    if (ratio) { if (w / h > ratio) h = w / ratio; else w = h * ratio; }
    w = Math.max(w, px(20));
    h = Math.max(h, px(20));
    return { x: wp.x < ax ? ax - w : ax, y: wp.y < ay ? ay - h : ay, w, h };
  }

  function cornerGesture(target, corner, ratio, label) {
    let started = false;
    const anchor = { x: target.x, y: target.y, w: target.w, h: target.h };
    return {
      move(sp, wp) {
        if (!started) { started = true; S.checkpoint(label); E.busy = true; }
        // Mantém o canto oposto fixo
        const r = rectResize(anchor, corner, wp, ratio);
        Object.assign(target, r);
        S.changed();
        requestDraw();
        updateZoomLabel();
      },
      up() { if (started) { E.busy = false; S.changed(); } },
      cursor: 'nwse-resize'
    };
  }

  function frameMoveGesture(sp0) {
    let started = false;
    let last = toWorld(sp0.x, sp0.y);
    const f = S.doc.frame;
    return {
      move(sp, wp) {
        if (!started) { if (Math.hypot(sp.x - sp0.x, sp.y - sp0.y) <= threshold()) return; started = true; S.checkpoint(); E.busy = true; }
        f.x += wp.x - last.x;
        f.y += wp.y - last.y;
        last = wp;
        S.changed();
        requestDraw();
      },
      up() { if (started) { E.busy = false; S.changed(); } },
      cursor: 'move'
    };
  }

  function focusGesture(sp0, wp0) {
    let started = false;
    return {
      move(sp, wp) {
        if (!started) { if (Math.hypot(sp.x - sp0.x, sp.y - sp0.y) <= threshold()) return; started = true; }
        E.focusDraft = Object.assign(S.styleFor('focus'), { x: Math.min(wp0.x, wp.x), y: Math.min(wp0.y, wp.y), w: Math.abs(wp.x - wp0.x), h: Math.abs(wp.y - wp0.y) });
        requestDraw();
      },
      up(sp, wp) {
        const f = S.doc.frame;
        let rect = E.focusDraft;
        E.focusDraft = null;
        if (!rect || rect.w < px(12) || rect.h < px(12)) {
          const w = f.w * 0.45, h = f.h * 0.6;
          rect = { x: wp.x - w / 2, y: wp.y - h / 2, w, h };
        }
        S.create('focus', { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
        setTool('select');
      },
      cancel() { E.focusDraft = null; requestDraw(); },
      cursor: 'crosshair'
    };
  }

  function placeObject(type, wp) {
    if (type === 'text') {
      S.create('text', { x: wp.x, y: wp.y });
      setTool('select');
      App.actions.focusField('text');
    } else if (type === 'marker') {
      S.create('marker', { x: wp.x, y: wp.y });
      setTool('select');
    } else if (type === 'compass') {
      S.create('compass', { x: wp.x, y: wp.y });
      setTool('select');
    } else if (type === 'legend') {
      S.create('legend', { x: wp.x, y: wp.y });
      setTool('select');
    }
  }

  function selectDown(sp, wp, e) {
    const sel = S.selected();
    const hnd = handleAt(sp);
    if (hnd && sel) {
      if (hnd.kind === 'vertex') { S.select(sel.id, hnd.nodeId); return vertexGesture(sel, hnd.nodeId, sp, null); }
      if (hnd.kind === 'mid') return vertexGesture(sel, null, sp, hnd.seg);
      if (hnd.kind === 'rotate') return rotateGesture(sel, e.shiftKey);
      if (hnd.kind === 'corner') return cornerGesture(sel, hnd.corner, null, 'focus-resize');
    }
    // Nome de rua: arrastar muda a posição do nome
    const labelId = R.roadLabelAt(wp);
    const labelObj = labelId && S.get(labelId);
    if (labelObj && labelObj.visible !== false && !labelObj.locked) {
      S.select(labelObj.id, null);
      return labelGesture(labelObj, sp);
    }
    const hit = R.hitTest(S.doc, wp, px(tolPx()));
    if (hit) {
      const wasSelected = hit.id === S.sel.id;
      S.select(hit.id, null);
      const small = !S.isPath(hit) && hit.type !== 'focus';
      if (!hit.locked && (wasSelected || small)) return moveGesture(hit, sp, wp);
      return tapOrPan(sp, null);
    }
    return tapOrPan(sp, () => S.select(null));
  }

  function frameDown(sp, wp) {
    const hnd = handleAt(sp);
    if (hnd) return cornerGesture(S.doc.frame, hnd.corner, M.frameRatio(), 'frame');
    const f = S.doc.frame;
    if (wp.x >= f.x && wp.x <= f.x + f.w && wp.y >= f.y && wp.y <= f.y + f.h) return frameMoveGesture(sp);
    return tapOrPan(sp, null);
  }

  function toolDown(sp, wp, e) {
    switch (E.tool) {
      case 'select': return selectDown(sp, wp, e);
      case 'road':
      case 'area': return tapOrPan(sp, (spU, wpU, eU) => addDraftPoint(wpU, spU, eU && eU.shiftKey));
      case 'focus': return focusGesture(sp, wp);
      case 'frame': return frameDown(sp, wp);
      case 'number': return tapOrPan(sp, (spU, wpU) => numberTap(wpU));
      case 'text': case 'marker': case 'compass': case 'legend':
        return tapOrPan(sp, (spU, wpU) => placeObject(E.tool, wpU));
      default: return panGesture(sp);
    }
  }

  /* ---------- Eventos de ponteiro ---------- */

  function localPoint(e) {
    const r = E.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e) {
    if (e.button === 2) return;
    E.canvas.focus({ preventScroll: true });
    E.pointerType = e.pointerType || 'mouse';
    const sp = localPoint(e);
    E.pointers.set(e.pointerId, sp);
    try { E.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    if (E.pointers.size === 2) {
      if (E.gesture && E.gesture.cancel) E.gesture.cancel();
      if (E.busy) { E.busy = false; S.changed(); }
      E.gesture = pinchGesture();
      return;
    }
    if (E.pointers.size > 2 || E.ignorePointers) return;
    const wp = toWorld(sp.x, sp.y);
    E.shiftDown = e.shiftKey;
    E.altDown = e.altKey;
    if (e.button === 1 || E.spaceDown || E.tool === 'pan') E.gesture = panGesture(sp);
    else E.gesture = toolDown(sp, wp, e);
    if (E.gesture && E.gesture.cursor) E.canvas.style.cursor = E.gesture.cursor;
    e.preventDefault();
  }

  function onPointerMove(e) {
    const sp = localPoint(e);
    if (E.pointers.has(e.pointerId)) E.pointers.set(e.pointerId, sp);
    E.shiftDown = e.shiftKey;
    E.altDown = e.altKey;
    const wp = toWorld(sp.x, sp.y);
    if (E.gesture) { E.gesture.move(sp, wp, e); return; }
    if (e.pointerType === 'mouse' || !e.pointerType) hover(sp, wp);
  }

  function onPointerUp(e) {
    const sp = localPoint(e);
    const had = E.pointers.has(e.pointerId);
    E.pointers.delete(e.pointerId);
    if (!had) return;
    const g = E.gesture;
    if (g && g.pinch) {
      E.gesture = null;
      // Ignora o dedo que sobrou até que todos sejam levantados
      E.ignorePointers = E.pointers.size > 0;
      return;
    }
    if (!E.pointers.size) E.ignorePointers = false;
    if (!g) return;
    E.gesture = null;
    if (e.type === 'pointercancel') { if (g.cancel) g.cancel(); E.busy = false; return; }
    g.up(sp, toWorld(sp.x, sp.y), e);
    updateCursor(sp);
    requestDraw();
  }

  function hover(sp, wp) {
    E.hover = wp;
    if (DRAW_TOOLS.includes(E.tool)) {
      if (E.draft) livePoint(wp); else E.snap = findSnap(wp);
      requestDraw();
    } else if (E.tool === 'select') {
      const hit = handleAt(sp) ? null : R.hitTest(S.doc, wp, px(tolPx()));
      const id = hit ? hit.id : null;
      if (id !== E.hoverId) { E.hoverId = id; requestDraw(); }
    }
    updateCursor(sp);
  }

  function updateCursor(sp) {
    let cur = 'default';
    if (E.spaceDown || E.tool === 'pan') cur = 'grab';
    else if (E.tool === 'number') cur = 'pointer';
    else if (DRAW_TOOLS.includes(E.tool) || ['text', 'marker', 'compass', 'legend', 'focus'].includes(E.tool)) cur = 'crosshair';
    else if (sp) {
      const hnd = handleAt(sp);
      if (hnd) cur = hnd.kind === 'rotate' ? 'alias' : hnd.kind === 'corner' || hnd.kind === 'frameCorner' ? 'nwse-resize' : 'grab';
      else if (E.tool === 'frame') {
        const wp = toWorld(sp.x, sp.y), f = S.doc.frame;
        cur = wp.x >= f.x && wp.x <= f.x + f.w && wp.y >= f.y && wp.y <= f.y + f.h ? 'move' : 'grab';
      } else if (E.tool === 'select' && R.roadLabelAt(toWorld(sp.x, sp.y))) {
        cur = 'grab';
      } else if (E.hoverId) {
        const o = S.get(E.hoverId);
        cur = o && !o.locked && (o.id === S.sel.id || (!S.isPath(o) && o.type !== 'focus')) ? 'move' : 'pointer';
      }
    }
    E.canvas.style.cursor = cur;
  }

  function onWheel(e) {
    e.preventDefault();
    const sp = localPoint(e);
    // Trackpad: dois dedos movem; pinça (ctrl) dá zoom. Mouse: roda dá zoom.
    const isTrackpadPan = !e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > 0 && Math.abs(e.deltaY) < 50;
    if (isTrackpadPan) {
      E.view.ox -= e.deltaX;
      E.view.oy -= e.deltaY;
      requestDraw();
      return;
    }
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(sp.x, sp.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
  }

  /* ---------- Numerar quadras tocando ---------- */

  function startNumbering() {
    const blocks = S.doc.objects.filter(M.isBlock);
    if (!blocks.length) { App.ui.toast('Não há quadras numeradas neste mapa.'); return; }
    S.select(null);
    E.numbering = { next: 1, done: [], started: false };
    setTool('number');
  }

  function numberTap(wp) {
    const nb = E.numbering;
    const hit = R.hitTest(S.doc, wp, px(tolPx()), (o) => o.type === 'area');
    if (!hit || nb.done.includes(hit.id)) return;
    if (!nb.started) { S.checkpoint(); nb.started = true; }
    hit.name = String(nb.next++);
    if (!hit.role) hit.role = 'block';
    nb.done.push(hit.id);
    S.changed();
    if (S.doc.objects.filter(M.isBlock).every((o) => nb.done.includes(o.id))) { finishNumbering(); return; }
    updateHint();
  }

  // As quadras não tocadas continuam depois, na ordem em que estavam.
  function finishNumbering() {
    const nb = E.numbering;
    if (nb && nb.started) {
      let n = nb.next;
      S.doc.objects.filter((o) => M.isBlock(o) && !nb.done.includes(o.id))
        .sort((a, b) => M.blockNumber(a) - M.blockNumber(b))
        .forEach((o) => { o.name = String(n++); });
      S.breakMerge();
      S.changed();
      App.ui.toast('Quadras renumeradas.', { type: 'ok', action: { label: 'Desfazer', fn: () => S.undo() } });
    }
    E.numbering = null;
    setTool('select');
  }

  function undoNumberTap() {
    const nb = E.numbering;
    if (!nb || !nb.done.length) return;
    // Volta ao estado anterior ao modo e reaplica os toques, menos o último
    const ids = nb.done.slice(0, -1);
    S.undo();
    E.numbering = { next: 1, done: [], started: false };
    ids.forEach((id) => {
      const o = S.get(id);
      if (!o) return;
      if (!E.numbering.started) { S.checkpoint(); E.numbering.started = true; }
      o.name = String(E.numbering.next++);
      if (!o.role) o.role = 'block';
      E.numbering.done.push(id);
    });
    S.changed();
    updateHint();
  }

  function cancelNumbering() {
    if (E.numbering && E.numbering.started) S.undo();
    E.numbering = null;
    setTool('select');
  }

  /* ---------- Ferramentas e dicas ---------- */

  function setTool(tool) {
    if (E.tool === 'number' && tool !== 'number' && E.numbering) { finishNumbering(); if (tool === 'select') return; }
    if (E.draft && tool !== E.tool) {
      if (E.draft.pts.length >= M.MIN_POINTS[E.draft.type]) finishDraft(); else cancelDraft();
    }
    E.tool = tool;
    E.snap = null;
    E.hoverId = null;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    updateHint();
    updateCursor(null);
    requestDraw();
  }

  const HINTS = {
    pan: 'Arraste para mover o mapa. Use a roda do mouse ou dois dedos para zoom.',
    road: 'Toque no mapa para marcar o início da rua. Pontos perto de outras ruas se conectam sozinhos.',
    area: 'Toque ponto a ponto para contornar a área do território.',
    text: 'Toque onde o texto deve ficar.',
    marker: 'Toque para colocar um ponto de referência.',
    compass: 'Toque onde a seta do norte deve ficar.',
    legend: 'Toque onde a legenda deve começar (canto superior esquerdo).',
    focus: 'Arraste para marcar a região em destaque, ou toque para um foco padrão.',
    frame: 'Arraste o cartão para movê-lo e os cantos para redimensionar. Tudo que estiver dentro será exportado.'
  };

  function updateHint() {
    const bar = document.getElementById('hintbar');
    const text = document.getElementById('hintText');
    const actions = document.getElementById('hintActions');
    if (!bar) return;
    actions.innerHTML = '';
    const btn = (label, fn, cls) => {
      const b = document.createElement('button');
      b.className = 'btn small ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
      return b;
    };
    const d = E.draft;
    if (d) {
      const n = d.pts.length;
      const min = M.MIN_POINTS[d.type];
      const kb = touchy() ? '' : ' <kbd>Enter</kbd> conclui · <kbd>Esc</kbd> cancela';
      text.innerHTML = (d.type === 'road' ? 'Rua: ' : 'Área: ') + n + (n === 1 ? ' ponto.' : ' pontos.') +
        (n < min ? ' Continue marcando.' : d.type === 'area' ? ' Toque no primeiro ponto para fechar.' : ' Toque no último ponto para concluir.') + kb;
      btn('Desfazer ponto', undoDraftPoint);
      btn('Cancelar', cancelDraft);
      const ok = btn('Concluir', finishDraft, 'primary');
      ok.disabled = n < min;
      bar.hidden = false;
      return;
    }
    if (E.tool === 'number' && E.numbering) {
      const nb = E.numbering;
      text.innerHTML = 'Toque nas quadras na nova ordem. Próximo número: <b>' + nb.next + '</b>. As que você não tocar seguem depois, na ordem atual.';
      btn('Cancelar', cancelNumbering);
      const u = btn('Desfazer toque', undoNumberTap);
      u.disabled = !nb.done.length;
      btn('Concluir', finishNumbering, 'primary');
      bar.hidden = false;
      return;
    }
    if (E.tool === 'frame') {
      text.textContent = HINTS.frame;
      btn('Ajustar ao mapa', () => App.actions.settingsAction('frameFit'));
      btn('Pronto', () => setTool('select'), 'primary');
      bar.hidden = false;
      return;
    }
    const hint = HINTS[E.tool];
    if (hint) {
      text.textContent = hint;
      if (E.tool !== 'pan') btn('Cancelar', () => setTool('select'));
      bar.hidden = false;
    } else bar.hidden = true;
  }

  /* ---------- Teclado ---------- */

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  const TOOL_KEYS = { v: 'select', h: 'pan', r: 'road', a: 'area', t: 'text', p: 'marker', f: 'focus', n: 'compass', l: 'legend', c: 'frame' };

  function onKeyDown(e) {
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) S.redo(); else S.undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); S.redo(); return; }
    if (mod && key === 's') { e.preventDefault(); App.actions.settingsAction('saveVersion'); return; }
    if (isTyping(e)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    E.altDown = e.altKey;
    E.shiftDown = e.shiftKey;
    if (key === 'Alt') { e.preventDefault(); return; }
    if (key === ' ') { e.preventDefault(); if (!E.spaceDown) { E.spaceDown = true; updateCursor(null); } return; }
    if (mod && key === 'd') { e.preventDefault(); if (S.sel.id) App.actions.objectAction('duplicate', S.sel.id); return; }
    if (mod) return;

    const sel = S.selected();
    switch (key) {
      case 'Escape':
        if (E.tool === 'number') cancelNumbering();
        else if (E.draft) cancelDraft();
        else if (E.tool !== 'select') setTool('select');
        else if (S.sel.node) S.select(S.sel.id);
        else S.select(null);
        return;
      case 'Enter':
        if (E.tool === 'number') { e.preventDefault(); finishNumbering(); }
        else if (E.draft) { e.preventDefault(); finishDraft(); }
        return;
      case 'Backspace':
      case 'Delete':
        e.preventDefault();
        if (E.draft) { undoDraftPoint(); return; }
        if (!sel) return;
        if (S.sel.node) App.actions.objectAction('removeVertex', sel.id);
        else App.actions.objectAction('delete', sel.id);
        return;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
        if (!sel || sel.locked) return;
        e.preventDefault();
        const step = px(e.shiftKey ? 10 : 1);
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        S.checkpoint('nudge:' + sel.id);
        if (S.sel.node && sel.points) { const n = S.node(S.sel.node); n.x += dx; n.y += dy; } else S.moveBy(sel, dx, dy);
        S.changed();
        return;
      }
      case '+': case '=': zoomBy(1.25); return;
      case '-': case '_': zoomBy(0.8); return;
      case '0': fitFrame(); return;
      case '?': App.ui.openShortcuts(); return;
      default:
        if (TOOL_KEYS[key] && !e.altKey) setTool(TOOL_KEYS[key]);
    }
  }

  function onKeyUp(e) {
    E.altDown = e.altKey;
    E.shiftDown = e.shiftKey;
    if (e.key === ' ') { E.spaceDown = false; updateCursor(null); }
  }

  /* ---------- Inicialização ---------- */

  function init() {
    E.canvas = document.getElementById('canvas');
    E.stage = document.getElementById('stage');
    E.ctx = E.canvas.getContext('2d');
    E.canvas.tabIndex = 0;
    E.canvas.addEventListener('pointerdown', onPointerDown);
    E.canvas.addEventListener('pointermove', onPointerMove);
    E.canvas.addEventListener('pointerup', onPointerUp);
    E.canvas.addEventListener('pointercancel', onPointerUp);
    E.canvas.addEventListener('pointerleave', () => { if (!E.gesture) { E.hover = null; E.hoverId = null; if (!E.draft) E.snap = null; requestDraw(); } });
    E.canvas.addEventListener('wheel', onWheel, { passive: false });
    E.canvas.addEventListener('dblclick', (e) => { if (E.draft) { e.preventDefault(); finishDraft(); } });
    E.canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); if (E.draft) finishDraft(); });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { E.spaceDown = false; E.altDown = false; });
    new ResizeObserver(() => resize()).observe(E.stage);
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); requestDraw(); });
    resize();
  }

  Object.assign(E, {
    init, resize, requestDraw, draw, setTool, fitFrame, zoomToRect, zoomBy, visibleWorld, updateHint, updateZoomLabel,
    finishDraft, cancelDraft, toWorld, startNumbering
  });
  App.editor = E;
})();
