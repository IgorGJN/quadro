(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  function exportPng() {
    const state = T.state;
    const out = document.createElement('canvas');

    const width = state.image ? state.image.width : 1600;
    const height = state.image ? state.image.height : 1000;

    out.width = width;
    out.height = height;

    const c = out.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, width, height);

    if (state.image) {
      c.drawImage(state.image, 0, 0);
    }

    state.objects.forEach(function (obj) {
      T.drawing.drawObject(c, obj, false);
    });

    out.toBlob(function (blob) {
      utils.downloadBlob(utils.safeName(state.projectName || 'mapa-final') + '.png', blob);
    });
  }

  T.exporter = {
    exportPng
  };
})();
