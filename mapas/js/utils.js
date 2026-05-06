(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function safeName(name) {
    return String(name || 'mapa')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'mapa';
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>'"]/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[char];
    });
  }

  function hexToRgba(hex, alpha) {
    const normalized = String(hex || '#ffffff').replace('#', '');
    const full = normalized.length === 3
      ? normalized.split('').map(function (x) { return x + x; }).join('')
      : normalized.padEnd(6, '0').slice(0, 6);

    const bigint = parseInt(full, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function downloadBlob(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 500);
  }

  function downloadText(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain' });
    downloadBlob(name, blob);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function projectPointOnSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: a.x, y: a.y, t: 0, distance: distance(p, a) };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = clamp(t, 0, 1);
    const projected = { x: a.x + t * dx, y: a.y + t * dy, t };
    projected.distance = distance(p, projected);
    return projected;
  }

  function segmentIntersection(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < 1e-9) return null;

    const uNumerator = (c.x - a.x) * r.y - (c.y - a.y) * r.x;
    const tNumerator = (c.x - a.x) * s.y - (c.y - a.y) * s.x;
    const t = tNumerator / denom;
    const u = uNumerator / denom;

    if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) return null;

    return {
      x: a.x + t * r.x,
      y: a.y + t * r.y,
      t1: t,
      t2: u
    };
  }

  T.utils = {
    uid,
    clamp,
    safeName,
    escapeHtml,
    hexToRgba,
    distance,
    clone,
    downloadBlob,
    downloadText,
    readFileAsDataUrl,
    readFileAsText,
    projectPointOnSegment,
    segmentIntersection
  };
})();
