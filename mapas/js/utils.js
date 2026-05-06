(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});

  function uid() {
    return Math.random().toString(36).slice(2, 10);
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
    readFileAsText
  };
})();
