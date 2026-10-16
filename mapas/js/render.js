/* Renderização do mapa (editor e exportação) e testes de clique. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;
  const S = App.store;

  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const SYMBOL_FONT = '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "Apple Symbols", system-ui, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');

  /* ---------- Imagens do mapa base ---------- */

  const images = {
    map: new Map(),
    async add(id, dataUrl, img) {
      const image = img || (await U.loadImage(dataUrl));
      const entry = { id, dataUrl, img: image, gray: null };
      this.map.set(id, entry);
      return entry;
    },
    get(id) { return id ? this.map.get(id) || null : null; },
    grayOf(entry) {
      if (entry.gray) return entry.gray;
      const c = document.createElement('canvas');
      c.width = entry.img.naturalWidth;
      c.height = entry.img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(entry.img, 0, 0);
      try {
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          px[i] = px[i + 1] = px[i + 2] = l;
        }
        ctx.putImageData(data, 0, 0);
      } catch (e) { /* imagem sem permissão de leitura: mantém colorida */ }
      entry.gray = c;
      return c;
    }
  };
  App.images = images;

  /* ---------- Primitivas ---------- */

  function tracePath(c, pts, closed, smooth) {
    c.beginPath();
    if (pts.length < 2) return;
    if (!smooth || pts.length < 3) {
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
      if (closed) c.closePath();
      return;
    }
    if (closed) {
      const n = pts.length;
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const start = mid(pts[n - 1], pts[0]);
      c.moveTo(start.x, start.y);
      for (let i = 0; i < n; i++) {
        const m = mid(pts[i], pts[(i + 1) % n]);
        c.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
      }
      c.closePath();
      return;
    }
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    c.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  function font(size, bold) { return (bold ? '700 ' : '500 ') + Math.max(0.5, size) + 'px ' + FONT; }

  function haloText(c, text, x, y, opts) {
    c.font = opts.font;
    c.textAlign = opts.align || 'center';
    c.textBaseline = 'middle';
    if (opts.haloWidth > 0) {
      c.lineJoin = 'round';
      c.miterLimit = 2;
      c.lineWidth = opts.haloWidth;
      c.strokeStyle = opts.halo || '#ffffff';
      c.strokeText(text, x, y);
    }
    c.fillStyle = opts.color;
    c.fillText(text, x, y);
  }

  function multiline(c, text, x, y, size, opts) {
    const lines = String(text || '').split('\n');
    const lh = size * 1.22;
    lines.forEach((line, i) => haloText(c, line, x, y + (i - (lines.length - 1) / 2) * lh, opts));
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ---------- Medidas ---------- */

  function textBox(obj) {
    measure.font = font(obj.size, obj.bold !== false);
    const lines = String(obj.text || '').split('\n');
    const w = Math.max(obj.size * 0.6, ...lines.map((l) => measure.measureText(l).width)) + (obj.haloWidth || 0);
    return { w, h: lines.length * obj.size * 1.22 + (obj.haloWidth || 0) };
  }

  function markerLabelBox(obj) {
    if (!obj.name) return null;
    measure.font = font(obj.labelSize, true);
    const lines = String(obj.name).split('\n');
    const w = Math.max(...lines.map((l) => measure.measureText(l).width));
    const h = lines.length * obj.labelSize * 1.22;
    return { x: obj.x + obj.size * 0.62, y: obj.y - h / 2, w, h };
  }

  function legendEntries(obj, doc) {
    const rows = [];
    if (obj.auto) {
      const visible = doc.objects.filter((o) => o.visible !== false);
      const seenArea = new Set();
      visible.filter((o) => o.type === 'area' && o.name).forEach((o) => {
        const key = o.name + o.fill;
        if (seenArea.has(key)) return;
        seenArea.add(key);
        rows.push({ kind: 'area', obj: o, label: o.name.split('\n')[0] });
      });
      const roadGroups = new Map();
      visible.filter((o) => o.type === 'road').forEach((o) => {
        const key = o.color + '|' + (o.dashed ? 'd' : 's');
        if (!roadGroups.has(key)) roadGroups.set(key, []);
        roadGroups.get(key).push(o);
      });
      roadGroups.forEach((list) => {
        const names = new Set(list.map((o) => o.name || ''));
        const label = names.size === 1 && list[0].name ? list[0].name : roadGroups.size > 1 ? 'Ruas (' + list.length + ')' : 'Ruas do território';
        rows.push({ kind: 'road', obj: list[0], label });
      });
      const markerGroups = new Map();
      visible.filter((o) => o.type === 'marker').forEach((o) => {
        const key = o.icon + '|' + o.color + '|' + o.style;
        if (!markerGroups.has(key)) markerGroups.set(key, []);
        markerGroups.get(key).push(o);
      });
      markerGroups.forEach((list) => {
        const names = new Set(list.map((o) => o.name || ''));
        const label = names.size === 1 && list[0].name ? list[0].name.split('\n')[0] : M.iconById(list[0].icon).label;
        rows.push({ kind: 'marker', obj: list[0], label });
      });
    }
    String(obj.text || '').split('\n').filter((l) => l.trim()).forEach((l) => rows.push({ kind: 'text', label: l }));
    return rows;
  }

  function legendLayout(obj, doc) {
    const s = obj.size;
    const pad = s * 0.8, rowH = s * 1.65, sw = s * 1.7, gap = s * 0.6;
    const rows = legendEntries(obj, doc || S.doc);
    measure.font = font(s * 1.12, true);
    const titleW = obj.title ? measure.measureText(obj.title).width : 0;
    measure.font = font(s, false);
    let rowW = 0;
    rows.forEach((r) => { rowW = Math.max(rowW, (r.kind === 'text' ? 0 : sw + gap) + measure.measureText(r.label).width); });
    const titleH = obj.title ? s * 1.7 : 0;
    const w = Math.max(titleW, rowW, s * 6) + pad * 2;
    const h = pad * 2 + titleH + rows.length * rowH - (rows.length ? s * 0.25 : 0);
    return { w, h, rows, pad, rowH, sw, gap, titleH };
  }

  function objectBounds(obj) {
    if (obj.points) {
      const b = U.bounds(S.points(obj));
      const m = obj.type === 'road' ? obj.width / 2 + (obj.casing || 0) : (obj.strokeWidth || 0) / 2;
      return { x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 };
    }
    if (obj.type === 'focus' || obj.type === 'legend') {
      if (obj.type === 'legend') { const l = legendLayout(obj); return { x: obj.x, y: obj.y, w: l.w, h: l.h }; }
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    }
    if (obj.type === 'text') {
      const t = textBox(obj);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => U.rotate({ x: obj.x + (sx * t.w) / 2, y: obj.y + (sy * t.h) / 2 }, obj.rotation || 0, obj));
      return U.bounds(corners);
    }
    if (obj.type === 'marker') {
      const r = obj.size / 2;
      let b = { x: obj.x - r, y: obj.y - r, w: r * 2, h: r * 2 };
      const lb = markerLabelBox(obj);
      if (lb) b = U.rectsUnion(b, lb);
      return b;
    }
    if (obj.type === 'compass') {
      const s = obj.size;
      return { x: obj.x - s * 0.5, y: obj.y - s * 0.95, w: s, h: s * 1.4 };
    }
    return { x: obj.x || 0, y: obj.y || 0, w: 1, h: 1 };
  }

  /* ---------- Desenho dos objetos ---------- */

  function drawArea(c, obj) {
    const pts = S.points(obj);
    if (pts.length < 2) return;
    tracePath(c, pts, true, obj.smooth);
    c.fillStyle = U.hexToRgba(obj.fill, obj.fillOpacity);
    c.fill();
    if (obj.strokeWidth > 0) {
      c.lineJoin = 'round';
      c.lineWidth = obj.strokeWidth;
      c.strokeStyle = obj.stroke;
      c.setLineDash(obj.dashed ? [obj.strokeWidth * 3, obj.strokeWidth * 2] : []);
      c.stroke();
      c.setLineDash([]);
    }
  }

  function drawAreaLabel(c, obj) {
    if (!obj.name) return;
    const pts = S.points(obj);
    if (pts.length < 3) return;
    const p = U.polygonLabelPoint(pts);
    multiline(c, obj.name, p.x, p.y, obj.labelSize, { font: font(obj.labelSize, true), color: obj.labelColor, halo: '#ffffff', haloWidth: obj.labelSize * 0.28 });
  }

  function drawRoads(c, roads) {
    const valid = roads.filter((r) => r.points.length >= 2);
    const shared = new Map();
    valid.forEach((r) => r.points.forEach((id) => {
      if (!shared.has(id)) shared.set(id, []);
      shared.get(id).push(r);
    }));
    const caps = (phase) => {
      shared.forEach((list, id) => {
        if (list.length < 2) return;
        const n = S.node(id);
        if (!n) return;
        const top = list[list.length - 1];
        const r = phase === 'casing' ? Math.max(...list.map((o) => o.width / 2 + (o.casing || 0))) : Math.max(...list.map((o) => o.width / 2));
        if (phase === 'casing' && !list.some((o) => o.casing > 0)) return;
        c.beginPath();
        c.arc(n.x, n.y, r, 0, Math.PI * 2);
        c.fillStyle = phase === 'casing' ? top.casingColor : top.color;
        c.fill();
      });
    };
    // Duas passadas: todos os contornos e depois todos os miolos, para que o
    // contorno de uma rua nunca corte outra rua ligada a ela.
    valid.forEach((r) => {
      if (!(r.casing > 0)) return;
      tracePath(c, S.points(r), false, r.smooth);
      c.lineCap = r.rounded ? 'round' : 'butt';
      c.lineJoin = r.rounded ? 'round' : 'miter';
      c.lineWidth = r.width + r.casing * 2;
      c.strokeStyle = r.casingColor;
      c.stroke();
    });
    caps('casing');
    valid.forEach((r) => {
      tracePath(c, S.points(r), false, r.smooth);
      c.lineCap = r.rounded ? 'round' : 'butt';
      c.lineJoin = r.rounded ? 'round' : 'miter';
      c.lineWidth = r.width;
      c.strokeStyle = r.color;
      c.setLineDash(r.dashed ? [r.width * 2, r.width * 1.4] : []);
      c.stroke();
      c.setLineDash([]);
    });
    if (valid.every((r) => !r.dashed)) caps('fill');
  }

  function areaLabelBox(obj) {
    if (!obj.name) return null;
    const pts = S.points(obj);
    if (pts.length < 3) return null;
    const p = U.polygonLabelPoint(pts);
    measure.font = font(obj.labelSize, true);
    const lines = String(obj.name).split('\n');
    const w = Math.max(...lines.map((l) => measure.measureText(l).width));
    const h = lines.length * obj.labelSize * 1.22;
    return { x: p.x - w / 2, y: p.y - h / 2, w, h };
  }

  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  // Nome da rua escrito sobre um trecho longo, na direção de leitura,
  // evitando ficar por baixo do nome de uma área.
  function roadLabelPlacement(obj, avoid) {
    const pts = S.points(obj);
    if (pts.length < 2) return null;
    measure.font = font(obj.labelSize, true);
    const tw = measure.measureText(obj.name || '').width;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push({ i, len: U.dist(pts[i], pts[i + 1]) });
    segs.sort((m, n) => n.len - m.len);
    let first = null;
    for (const s of segs) {
      for (const t of [0.5, 0.3, 0.7, 0.18, 0.82]) {
        const a = pts[s.i], b = pts[s.i + 1];
        let ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: ang };
        if (!first) first = p;
        const hw = (Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * obj.labelSize) / 2;
        const hh = (Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * obj.labelSize) / 2;
        const box = { x: p.x - hw, y: p.y - hh, w: hw * 2, h: hh * 2 };
        if (!(avoid || []).some((r) => overlaps(r, box))) return p;
      }
    }
    return first;
  }

  function drawRoadLabel(c, obj, avoid) {
    if (!obj.name || !obj.showLabel) return;
    const p = roadLabelPlacement(obj, avoid);
    if (!p) return;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    haloText(c, obj.name, 0, 0, { font: font(obj.labelSize, true), color: obj.labelColor, halo: '#ffffff', haloWidth: obj.labelSize * 0.3 });
    c.restore();
  }

  function focusShapePath(c, obj) {
    if (obj.shape === 'ellipse') c.ellipse(obj.x + obj.w / 2, obj.y + obj.h / 2, Math.max(1, obj.w / 2), Math.max(1, obj.h / 2), 0, 0, Math.PI * 2);
    else c.rect(obj.x, obj.y, obj.w, obj.h);
  }

  function drawFocus(c, obj, cover, draft) {
    c.beginPath();
    c.rect(cover.x, cover.y, cover.w, cover.h);
    focusShapePath(c, obj);
    c.fillStyle = U.hexToRgba(obj.maskColor, obj.maskOpacity);
    c.fill('evenodd');
    if (obj.strokeWidth > 0 || draft) {
      c.beginPath();
      focusShapePath(c, obj);
      c.lineWidth = obj.strokeWidth || 2;
      c.strokeStyle = obj.stroke;
      c.setLineDash(obj.dashed || draft ? [obj.strokeWidth * 3 || 8, obj.strokeWidth * 2 || 6] : []);
      c.stroke();
      c.setLineDash([]);
    }
    if (obj.name) {
      multiline(c, obj.name, obj.x + obj.w / 2, obj.y - obj.labelSize * 0.9, obj.labelSize, { font: font(obj.labelSize, true), color: obj.stroke, halo: '#ffffff', haloWidth: obj.labelSize * 0.28 });
    }
  }

  function drawText(c, obj) {
    c.save();
    c.translate(obj.x, obj.y);
    c.rotate(((obj.rotation || 0) * Math.PI) / 180);
    multiline(c, obj.text, 0, 0, obj.size, { font: font(obj.size, obj.bold !== false), color: obj.color, halo: obj.halo, haloWidth: obj.haloWidth });
    c.restore();
  }

  function drawMarkerGlyph(c, x, y, size, iconId, color, style) {
    const icon = M.iconById(iconId);
    if (style === 'symbol') {
      const g = icon.glyph || '●';
      haloText(c, g, x, y, { font: '700 ' + size + 'px ' + SYMBOL_FONT, color, halo: '#ffffff', haloWidth: size * 0.16 });
      return;
    }
    const r = size / 2;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.lineWidth = Math.max(1, size * 0.1);
    c.strokeStyle = '#ffffff';
    c.stroke();
    if (icon.glyph) {
      c.font = '700 ' + size * 0.56 + 'px ' + SYMBOL_FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffffff';
      c.fillText(icon.glyph, x, y + size * 0.03);
    } else {
      c.beginPath();
      c.arc(x, y, r * 0.32, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
    }
  }

  function drawMarker(c, obj) {
    drawMarkerGlyph(c, obj.x, obj.y, obj.size, obj.icon, obj.color, obj.style);
    const lb = markerLabelBox(obj);
    if (lb) {
      const lines = String(obj.name).split('\n');
      lines.forEach((line, i) => haloText(c, line, lb.x, obj.y + (i - (lines.length - 1) / 2) * obj.labelSize * 1.22, { font: font(obj.labelSize, true), color: '#16203a', halo: '#ffffff', haloWidth: obj.labelSize * 0.3, align: 'left' }));
    }
  }

  function drawCompass(c, obj) {
    const s = obj.size;
    c.save();
    c.translate(obj.x, obj.y);
    c.rotate(((obj.rotation || 0) * Math.PI) / 180);
    c.lineJoin = 'round';
    const tip = { x: 0, y: -s / 2 }, l = { x: -s * 0.24, y: s * 0.4 }, notch = { x: 0, y: s * 0.2 }, r = { x: s * 0.24, y: s * 0.4 };
    // Contorno claro para destacar sobre qualquer mapa
    c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(l.x, l.y); c.lineTo(notch.x, notch.y); c.lineTo(r.x, r.y); c.closePath();
    c.lineWidth = s * 0.09; c.strokeStyle = '#ffffff'; c.stroke();
    c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(r.x, r.y); c.lineTo(notch.x, notch.y); c.closePath();
    c.fillStyle = '#ffffff'; c.fill();
    c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(l.x, l.y); c.lineTo(notch.x, notch.y); c.closePath();
    c.fillStyle = obj.color; c.fill();
    c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(l.x, l.y); c.lineTo(notch.x, notch.y); c.lineTo(r.x, r.y); c.closePath();
    c.lineWidth = Math.max(1, s * 0.035); c.strokeStyle = obj.color; c.stroke();
    haloText(c, 'N', 0, -s / 2 - s * 0.24, { font: font(s * 0.34, true), color: obj.color, halo: '#ffffff', haloWidth: s * 0.08 });
    c.restore();
  }

  function drawLegend(c, obj, doc) {
    const L = legendLayout(obj, doc);
    const s = obj.size;
    roundRect(c, obj.x, obj.y, L.w, L.h, s * 0.45);
    c.fillStyle = U.hexToRgba(obj.bg, obj.bgOpacity);
    c.fill();
    if (obj.borderWidth > 0) { c.lineWidth = obj.borderWidth; c.strokeStyle = obj.border; c.stroke(); }
    let y = obj.y + L.pad;
    const x = obj.x + L.pad;
    if (obj.title) {
      haloText(c, obj.title, x, y + s * 0.6, { font: font(s * 1.12, true), color: obj.color, haloWidth: 0, align: 'left' });
      y += L.titleH;
    }
    L.rows.forEach((row) => {
      const cy = y + s * 0.6;
      if (row.kind === 'area') {
        const o = row.obj;
        c.beginPath(); c.rect(x, cy - s * 0.5, L.sw, s);
        c.fillStyle = U.hexToRgba(o.fill, Math.max(o.fillOpacity, 0.35)); c.fill();
        c.lineWidth = Math.max(1, s * 0.12); c.strokeStyle = o.stroke;
        c.setLineDash(o.dashed ? [s * 0.3, s * 0.2] : []); c.stroke(); c.setLineDash([]);
      } else if (row.kind === 'road') {
        const o = row.obj;
        c.beginPath(); c.moveTo(x + s * 0.15, cy); c.lineTo(x + L.sw - s * 0.15, cy);
        c.lineCap = 'round';
        if (o.casing > 0) { c.lineWidth = s * 0.45 + s * 0.2; c.strokeStyle = o.casingColor === '#ffffff' ? '#d6dbe3' : o.casingColor; c.stroke(); }
        c.lineWidth = s * 0.45; c.strokeStyle = o.color;
        c.setLineDash(o.dashed ? [s * 0.5, s * 0.35] : []); c.stroke(); c.setLineDash([]);
      } else if (row.kind === 'marker') {
        const o = row.obj;
        drawMarkerGlyph(c, x + L.sw / 2, cy, s * 1.15, o.icon, o.color, o.style);
      }
      const tx = row.kind === 'text' ? x : x + L.sw + L.gap;
      haloText(c, row.label, tx, cy, { font: font(s, false), color: obj.color, haloWidth: 0, align: 'left' });
      y += L.rowH;
    });
  }

  /* ---------- Cena ---------- */

  // Desenha o mapa no contexto já transformado para coordenadas do mundo.
  // opts.cover: retângulo a ser coberto pela máscara do foco.
  function drawScene(c, doc, opts) {
    const o = opts || {};
    const f = doc.frame;
    c.save();
    c.fillStyle = '#ffffff';
    const paper = o.paper || f;
    c.fillRect(paper.x, paper.y, paper.w, paper.h);

    const entry = images.get(doc.base.imageId);
    if (entry && doc.base.visible) {
      c.globalAlpha = U.clamp(doc.base.opacity, 0, 1);
      c.imageSmoothingQuality = 'high';
      c.drawImage(doc.base.grayscale ? images.grayOf(entry) : entry.img, 0, 0, doc.base.width || entry.img.naturalWidth, doc.base.height || entry.img.naturalHeight);
      c.globalAlpha = 1;
    }

    const vis = doc.objects.filter((ob) => ob.visible !== false && ob.id !== o.hideId);
    const of = (types) => vis.filter((ob) => types.includes(ob.type));

    of(['area']).forEach((ob) => drawArea(c, ob));
    drawRoads(c, of(['road']));
    const areaLabels = of(['area']).map(areaLabelBox).filter(Boolean);
    of(['road']).forEach((ob) => drawRoadLabel(c, ob, areaLabels));
    of(['area']).forEach((ob) => drawAreaLabel(c, ob));
    of(['focus']).forEach((ob) => drawFocus(c, ob, o.cover || f, false));
    vis.filter((ob) => ['text', 'marker', 'compass', 'legend'].includes(ob.type)).forEach((ob) => {
      if (ob.type === 'text') drawText(c, ob);
      else if (ob.type === 'marker') drawMarker(c, ob);
      else if (ob.type === 'compass') drawCompass(c, ob);
      else drawLegend(c, ob, doc);
    });
    c.restore();
  }

  // Gera a imagem final do cartão, independente do zoom do editor.
  function renderFrame(doc, widthPx) {
    const f = doc.frame;
    const W = Math.round(widthPx);
    const H = Math.round((W * f.h) / f.w);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, W, H);
    const k = W / f.w;
    c.save();
    c.scale(k, k);
    c.translate(-f.x, -f.y);
    c.beginPath();
    c.rect(f.x, f.y, f.w, f.h);
    c.clip();
    drawScene(c, doc, { cover: f });
    c.restore();
    if (doc.base.attribution && doc.base.visible && doc.base.imageId) {
      const fs = Math.max(9, W * 0.0085);
      c.font = '500 ' + fs + 'px ' + FONT;
      c.textAlign = 'right';
      c.textBaseline = 'bottom';
      const tw = c.measureText(doc.base.attribution).width;
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.fillRect(W - tw - fs * 1.2, H - fs * 1.7, tw + fs * 1.2, fs * 1.7);
      c.fillStyle = '#333';
      c.fillText(doc.base.attribution, W - fs * 0.6, H - fs * 0.35);
    }
    return canvas;
  }

  /* ---------- Teste de clique ---------- */

  function hitObject(obj, p, tol) {
    if (obj.type === 'road') {
      const pts = S.points(obj);
      return pts.length > 1 && U.distToPolyline(p, pts, false) <= obj.width / 2 + (obj.casing || 0) + tol;
    }
    if (obj.type === 'area') {
      const pts = S.points(obj);
      return pts.length > 2 && (U.pointInPolygon(p, pts) || U.distToPolyline(p, pts, true) <= (obj.strokeWidth || 0) / 2 + tol);
    }
    if (obj.type === 'focus') {
      const band = (obj.strokeWidth || 0) / 2 + tol;
      if (obj.name && Math.abs(p.x - (obj.x + obj.w / 2)) < obj.w / 2 && p.y < obj.y && p.y > obj.y - obj.labelSize * 1.8) return true;
      if (obj.shape === 'ellipse') {
        const rx = obj.w / 2, ry = obj.h / 2;
        const nx = (p.x - obj.x - rx) / rx, ny = (p.y - obj.y - ry) / ry;
        return Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry) <= band;
      }
      const inOuter = p.x >= obj.x - band && p.x <= obj.x + obj.w + band && p.y >= obj.y - band && p.y <= obj.y + obj.h + band;
      const inInner = p.x > obj.x + band && p.x < obj.x + obj.w - band && p.y > obj.y + band && p.y < obj.y + obj.h - band;
      return inOuter && !inInner;
    }
    if (obj.type === 'text') {
      const t = textBox(obj);
      const q = U.rotate(p, -(obj.rotation || 0), obj);
      return Math.abs(q.x - obj.x) <= t.w / 2 + tol && Math.abs(q.y - obj.y) <= t.h / 2 + tol;
    }
    if (obj.type === 'marker') {
      if (U.dist(p, obj) <= obj.size / 2 + tol) return true;
      const lb = markerLabelBox(obj);
      return !!lb && p.x >= lb.x - tol && p.x <= lb.x + lb.w + tol && p.y >= lb.y - tol && p.y <= lb.y + lb.h + tol;
    }
    if (obj.type === 'compass') {
      const q = U.rotate(p, -(obj.rotation || 0), obj);
      const s = obj.size;
      return Math.abs(q.x - obj.x) <= s * 0.32 + tol && q.y >= obj.y - s * 0.95 - tol && q.y <= obj.y + s * 0.45 + tol;
    }
    if (obj.type === 'legend') {
      const b = objectBounds(obj);
      return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
    }
    return false;
  }

  // Do item mais alto para o mais baixo, seguindo a ordem de desenho.
  function hitTest(doc, p, tol, filter) {
    const order = M.DRAW_ORDER.slice().reverse();
    for (const g of order) {
      const list = doc.objects.filter((o) => o.visible !== false && M.groupOf(o.type) === g && (!filter || filter(o)));
      for (let i = list.length - 1; i >= 0; i--) if (hitObject(list[i], p, tol)) return list[i];
    }
    return null;
  }

  App.render = {
    FONT, tracePath, haloText, font, roundRect, textBox, legendLayout, objectBounds, roadLabelPlacement,
    drawScene, drawFocus, drawMarkerGlyph, renderFrame, hitTest, hitObject
  };
})();
