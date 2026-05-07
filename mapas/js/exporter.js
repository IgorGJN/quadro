(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  function exportPng() {
    const state = T.state;
    const wrap = document.getElementById('canvasWrap');
    const rect = wrap ? wrap.getBoundingClientRect() : { width: 1400, height: 580 };
    const viewW = Math.max(1, rect.width || 1400);
    const viewH = Math.max(1, rect.height || 580);

    const out = document.createElement('canvas');
    out.width = 2800;
    out.height = Math.round(out.width * 5.8 / 14);

    const c = out.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, out.width, out.height);

    const exportScale = Math.min(out.width / viewW, out.height / viewH);
    const padX = (out.width - viewW * exportScale) / 2;
    const padY = (out.height - viewH * exportScale) / 2;

    c.save();
    c.beginPath();
    c.rect(0, 0, out.width, out.height);
    c.clip();
    c.translate(padX, padY);
    c.scale(exportScale, exportScale);
    c.translate(state.offsetX, state.offsetY);
    c.scale(state.scale, state.scale);

    if (state.image && state.settings.mapVisible !== false) c.drawImage(state.image, 0, 0);
    T.drawing.drawSceneObjects(c, false);
    c.restore();

    out.toBlob(function (blob) {
      if (!blob) return;
      utils.downloadBlob(utils.safeName(state.projectName || 'mapa-final') + '.png', blob);
    });
  }

  T.exporter = { exportPng };
})();
