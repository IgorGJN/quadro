/* Utilidades gerais e geometria. Sem dependências. */
(function () {
  'use strict';

  const App = (window.App = window.App || {});

  const uid = (prefix) => (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

  function hexToRgba(hex, alpha) {
    let h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function debounce(fn, ms) {
    let t = null;
    const wrapped = function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(null, args); }, ms);
    };
    wrapped.flush = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    wrapped.pending = () => !!t;
    wrapped.cancel = () => { clearTimeout(t); t = null; };
    return wrapped;
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function safeFileName(name) {
    return String(name || 'mapa')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '')
      .toLowerCase() || 'mapa';
  }

  function relativeTime(iso) {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'agora mesmo';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    if (s < 86400 * 7) { const d = Math.round(s / 86400); return 'há ' + d + (d === 1 ? ' dia' : ' dias'); }
    return new Date(t).toLocaleDateString('pt-BR');
  }

  function formatDateTime(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- Geometria ---------- */

  function projectOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    const x = a.x + t * dx, y = a.y + t * dy;
    return { x, y, t, d: Math.hypot(p.x - x, p.y - y) };
  }

  // Interseção estrita entre segmentos (ignora as pontas).
  function segmentIntersection(a, b, c, d, margin) {
    const m = margin == null ? 0.001 : margin;
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
    if (t <= m || t >= 1 - m || u <= m || u >= 1 - m) return null;
    return { x: a.x + t * rx, y: a.y + t * ry, t, u };
  }

  function distToPolyline(p, pts, closed) {
    let best = Infinity;
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const r = projectOnSegment(p, pts[i], pts[(i + 1) % pts.length]);
      if (r.d < best) best = r.d;
    }
    return best;
  }

  function pointInPolygon(p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  function bounds(pts) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    pts.forEach((p) => { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  // Ponto bom para o rótulo de um polígono (inclusive côncavo): o ponto
  // interno mais afastado das bordas (busca em grade com refinamento). O
  // centróide é mantido quando já está bem no meio, para não "pular".
  function polygonLabelPoint(pts) {
    if (pts.length < 3) return pts[0] || { x: 0, y: 0 };
    const edgeDist = (p) => {
      let d = Infinity;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, projectOnSegment(p, pts[j], pts[i]).d);
      return d;
    };
    const score = (p) => (pointInPolygon(p, pts) ? edgeDist(p) : -1);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
      a += f; cx += (pts[j].x + pts[i].x) * f; cy += (pts[j].y + pts[i].y) * f;
    }
    const b = bounds(pts);
    const c = a ? { x: cx / (3 * a), y: cy / (3 * a) } : { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const cs = score(c);
    const N = 12;
    let best = c, bestS = cs;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const p = { x: b.x + (b.w * (i + 0.5)) / N, y: b.y + (b.h * (j + 0.5)) / N };
      const s = score(p);
      if (s > bestS) { bestS = s; best = p; }
    }
    let sx = b.w / N / 2, sy = b.h / N / 2;
    for (let k = 0; k < 4; k++, sx /= 2, sy /= 2) {
      const base = best;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const p = { x: base.x + i * sx, y: base.y + j * sy };
        const s = score(p);
        if (s > bestS) { bestS = s; best = p; }
      }
    }
    return cs >= bestS * 0.75 ? c : best;
  }

  function rotate(p, angleDeg, origin) {
    const a = (angleDeg * Math.PI) / 180;
    const o = origin || { x: 0, y: 0 };
    const dx = p.x - o.x, dy = p.y - o.y;
    return { x: o.x + dx * Math.cos(a) - dy * Math.sin(a), y: o.y + dx * Math.sin(a) + dy * Math.cos(a) };
  }

  function rectsUnion(a, b) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }

  /* ---------- Arquivos ---------- */

  function readFile(file, as) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      if (as === 'text') r.readAsText(file); else r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = src;
    });
  }

  function downloadBlob(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem.'))), type || 'image/png', quality));
  }

  // Reduz imagens enormes para manter o projeto leve e o desenho fluido.
  async function normalizeImageDataUrl(dataUrl, maxSide) {
    const img = await loadImage(dataUrl);
    const max = maxSide || 6000;
    const side = Math.max(img.naturalWidth, img.naturalHeight);
    if (side <= max) return { dataUrl, img };
    const k = max / side;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', 0.92);
    return { dataUrl: out, img: await loadImage(out) };
  }

  App.util = {
    uid, clamp, dist, clone, hexToRgba, debounce, escapeHtml, safeFileName, relativeTime, formatDateTime,
    projectOnSegment, segmentIntersection, distToPolyline, pointInPolygon, bounds, polygonLabelPoint, rotate, rectsUnion,
    readFile, loadImage, downloadBlob, canvasToBlob, normalizeImageDataUrl
  };
})();
