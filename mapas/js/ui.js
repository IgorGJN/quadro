/* Interface: ícones, avisos, diálogos, inspetor, camadas, ajustes e galeria. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;
  const S = App.store;
  const A = () => App.actions;

  /* ---------- Ícones (SVG em linha, sem dependências) ---------- */

  const ICONS = {
    cursor: '<path d="M5 3l14 7.5-6.2 1.6L10 18.5z"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
    road: '<path d="M5 21L10 3"/><path d="M19 21L14 3"/><path d="M12 6v2"/><path d="M12 11v2"/><path d="M12 16v2"/>',
    area: '<path d="M4 7.5L10 3l10 4-2.5 12.5L6 21z"/><circle cx="4" cy="7.5" r="1.2" fill="currentColor"/><circle cx="10" cy="3" r="1.2" fill="currentColor"/><circle cx="20" cy="7" r="1.2" fill="currentColor"/>',
    text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    marker: '<path d="M12 21.5s-7-6.2-7-11.5a7 7 0 0 1 14 0c0 5.3-7 11.5-7 11.5z"/><circle cx="12" cy="10" r="2.6"/>',
    focus: '<path d="M3 8V3h5"/><path d="M16 3h5v5"/><path d="M21 16v5h-5"/><path d="M8 21H3v-5"/><circle cx="12" cy="12" r="3.5"/>',
    compass: '<circle cx="12" cy="12" r="9.5"/><path d="M12 5.5l3 9-3-1.8-3 1.8z" fill="currentColor"/>',
    legend: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h2"/><path d="M12 9h5"/><path d="M7 13h2"/><path d="M12 13h5"/><path d="M7 17h2"/><path d="M12 17h3"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.9 3.9"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v5"/><path d="M14 11v5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    up: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    upload: '<path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>',
    globe: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8"/><rect x="7" y="13" width="10" height="8"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9"/><path d="M14.5 14.5L20 20"/><path d="M8.1 8.1L12 12"/>',
    unlink: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h3"/><path d="M3 3l18 18"/>',
    cross: '<path d="M12 3v18"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3"/>',
    layers: '<path d="M12 2l10 6-10 6L2 8z"/><path d="M2 16l10 6 10-6"/><path d="M2 12l10 6 10-6"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01"/><path d="M10 9h.01"/><path d="M14 9h.01"/><path d="M18 9h.01"/><path d="M7 15h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="M1 12h4"/><path d="M19 12h4"/>',
    wand: '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M17.8 6.2L19 5"/><path d="M3 21l9-9"/><path d="M12.2 6.2L11 5"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  };

  function icon(name, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.hydrated) return;
      el.innerHTML = icon(el.dataset.icon);
      el.dataset.hydrated = '1';
    });
  }

  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = U.escapeHtml;

  /* ---------- Avisos ---------- */

  function toast(message, opts) {
    const o = opts || {};
    const box = document.getElementById('toasts');
    const el = h('<div class="toast ' + (o.type || '') + '">' + (o.type === 'ok' ? icon('check') : o.type === 'error' ? icon('alert') : '') + '<span>' + esc(message) + '</span></div>');
    if (o.action) {
      const b = document.createElement('button');
      b.textContent = o.action.label;
      b.onclick = () => { o.action.fn(); close(); };
      el.appendChild(b);
    }
    box.appendChild(el);
    const close = () => { el.classList.add('leave'); setTimeout(() => el.remove(), 220); };
    setTimeout(close, o.duration || (o.action ? 6000 : 2800));
    while (box.children.length > 3) box.firstElementChild.remove();
  }

  /* ---------- Diálogos ---------- */

  function modal(opts) {
    const dlg = document.createElement('dialog');
    if (opts.className) dlg.className = opts.className;
    dlg.innerHTML = '<div class="dlg"><div class="dlg-head"><h2>' + esc(opts.title) + '</h2><button class="icon-btn" data-close aria-label="Fechar">' + icon('x') + '</button></div><div class="dlg-body"></div>' + (opts.foot !== false ? '<div class="dlg-foot"></div>' : '') + '</div>';
    const body = dlg.querySelector('.dlg-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    document.body.appendChild(dlg);
    const close = (value) => { if (dlg.open) dlg.close(value || ''); };
    dlg.addEventListener('close', () => { if (opts.onClose) opts.onClose(dlg.returnValue); setTimeout(() => dlg.remove(), 0); });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) close();
      if (e.target.closest('[data-close]')) close();
    });
    hydrateIcons(dlg);
    dlg.showModal();
    return { dlg, body, foot: dlg.querySelector('.dlg-foot'), close };
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      let answered = false;
      const m = modal({ title: opts.title, body: '<p>' + esc(opts.message) + '</p>', onClose: () => { if (!answered) resolve(false); } });
      m.dlg.style.width = 'min(440px, calc(100vw - 24px))';
      const cancel = h('<button class="btn">Cancelar</button>');
      const ok = h('<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '">' + esc(opts.ok || 'Confirmar') + '</button>');
      cancel.onclick = () => m.close();
      ok.onclick = () => { answered = true; resolve(true); m.close(); };
      m.foot.append(cancel, ok);
      ok.focus();
    });
  }

  function promptDialog(opts) {
    return new Promise((resolve) => {
      let answered = false;
      const m = modal({ title: opts.title, body: (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') + '<input class="input" />', onClose: () => { if (!answered) resolve(null); } });
      m.dlg.style.width = 'min(440px, calc(100vw - 24px))';
      const input = m.body.querySelector('input');
      input.value = opts.value || '';
      input.placeholder = opts.placeholder || '';
      const ok = h('<button class="btn primary">' + esc(opts.ok || 'OK') + '</button>');
      const submit = () => { answered = true; resolve(input.value.trim()); m.close(); };
      ok.onclick = submit;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
      const cancel = h('<button class="btn">Cancelar</button>');
      cancel.onclick = () => m.close();
      m.foot.append(cancel, ok);
      input.select();
    });
  }

  /* ---------- Controles de formulário ---------- */

  const PALETTE = ['#2f5fb3', '#0891b2', '#16a34a', '#facc15', '#f59e0b', '#dc2626', '#db2777', '#7c3aed', '#16203a', '#ffffff'];

  function fieldHtml(f, obj, disabled) {
    const v = obj[f.k];
    const dis = disabled ? ' disabled' : '';
    const id = 'f_' + f.k;
    switch (f.t) {
      case 'text':
        return '<div class="field"><label for="' + id + '">' + f.label + '</label><input class="input" id="' + id + '" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="' + esc(f.ph || '') + '"' + dis + ' /></div>';
      case 'textarea':
        return '<div class="field"><label for="' + id + '">' + f.label + '</label><textarea class="textarea" id="' + id + '" data-k="' + f.k + '" rows="' + (f.rows || 2) + '" placeholder="' + esc(f.ph || '') + '"' + dis + '>' + esc(v) + '</textarea>' + (f.help ? '<p class="note" style="margin:6px 0 0">' + f.help + '</p>' : '') + '</div>';
      case 'color':
        return '<div class="field"><div class="label">' + f.label + '</div><div class="color-field"><input type="color" data-k="' + f.k + '" value="' + esc(v) + '" aria-label="' + esc(f.label) + '"' + dis + ' />' +
          (f.swatches === false ? '' : '<div class="swatches">' + PALETTE.map((c) => '<button type="button" class="swatch' + (String(v).toLowerCase() === c ? ' active' : '') + '" style="background:' + c + '" data-swatch="' + f.k + '" data-color="' + c + '" title="' + c + '"' + dis + '></button>').join('') + '</div>') + '</div></div>';
      case 'range': {
        const shown = f.pct ? Math.round(v * 100) + '%' : v;
        return '<div class="field"><label for="' + id + '">' + f.label + ' <output>' + shown + '</output></label><input type="range" id="' + id + '" data-k="' + f.k + '" data-num="1" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + v + '"' + dis + ' /></div>';
      }
      case 'number': {
        const k = f.scale ? S.sizeFactor() : 1;
        const max = Math.round((f.max || 100) * k);
        const step = f.step || (k >= 4 ? Math.round(k) : 1);
        return '<div class="field"><label for="' + id + '">' + f.label + ' <output>' + fmtNum(v) + '</output></label><input type="range" id="' + id + '" data-k="' + f.k + '" data-num="1" min="' + (f.min || 0) + '" max="' + Math.max(max, Math.ceil(v)) + '" step="' + step + '" value="' + v + '"' + dis + ' /></div>';
      }
      case 'toggle':
        return '<label class="toggle"><span>' + f.label + (f.help ? '<small>' + f.help + '</small>' : '') + '</span><input type="checkbox" data-k="' + f.k + '"' + (v ? ' checked' : '') + dis + ' /><span class="track"></span></label>';
      case 'segmented':
        return '<div class="field"><div class="label">' + f.label + '</div><div class="segmented">' + f.options.map(([val, lab]) => '<button type="button" data-seg="' + f.k + '" data-val="' + esc(val) + '" class="' + (String(v) === String(val) ? 'active' : '') + '"' + dis + '>' + lab + '</button>').join('') + '</div></div>';
      case 'icons':
        return '<div class="field"><div class="label">' + f.label + ' <output>' + esc(M.iconById(v).label) + '</output></div><div class="icon-grid">' + M.ICONS.map((ic) => '<button type="button" class="icon-choice' + (ic.id === v ? ' active' : '') + '" data-seg="' + f.k + '" data-val="' + ic.id + '" title="' + esc(ic.label) + '"' + dis + '>' + (ic.glyph ? esc(ic.glyph) : '●') + '</button>').join('') + '</div></div>';
      case 'row':
        return '<div class="row">' + f.items.map((it) => fieldHtml(it, obj, disabled)).join('') + '</div>';
      default:
        return '';
    }
  }

  function fmtNum(v) { return Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10; }

  /* ---------- Esquema do inspetor por tipo ---------- */

  const SCHEMA = {
    road: [
      { k: 'name', t: 'text', label: 'Nome da rua', ph: 'Ex.: Rua das Flores' },
      { k: 'showLabel', t: 'toggle', label: 'Escrever o nome sobre a rua', when: (o) => !!o.name },
      { k: 'color', t: 'color', label: 'Cor' },
      { k: 'width', t: 'number', label: 'Largura', min: 1, max: 60, scale: true },
      { k: 'casing', t: 'number', label: 'Contorno', min: 0, max: 20, scale: true },
      { k: 'casingColor', t: 'color', label: 'Cor do contorno', when: (o) => o.casing > 0, swatches: false },
      { k: 'dashed', t: 'toggle', label: 'Tracejada' },
      { k: 'smooth', t: 'toggle', label: 'Suavizar curvas' },
      { k: 'rounded', t: 'toggle', label: 'Pontas arredondadas' },
      { k: 'labelSize', t: 'number', label: 'Tamanho do nome', min: 4, max: 60, scale: true, when: (o) => o.name && o.showLabel },
      { k: 'labelColor', t: 'color', label: 'Cor do nome', when: (o) => o.name && o.showLabel }
    ],
    area: [
      { k: 'name', t: 'textarea', label: 'Nome ou número do território', ph: 'Ex.: Território 12', rows: 2 },
      { k: 'fill', t: 'color', label: 'Preenchimento' },
      { k: 'fillOpacity', t: 'range', label: 'Opacidade do preenchimento', min: 0, max: 1, step: 0.05, pct: true },
      { k: 'stroke', t: 'color', label: 'Borda' },
      { k: 'strokeWidth', t: 'number', label: 'Espessura da borda', min: 0, max: 30, scale: true },
      { k: 'dashed', t: 'toggle', label: 'Borda tracejada' },
      { k: 'smooth', t: 'toggle', label: 'Suavizar contorno' },
      { k: 'labelSize', t: 'number', label: 'Tamanho do nome', min: 4, max: 140, scale: true, when: (o) => !!o.name },
      { k: 'labelColor', t: 'color', label: 'Cor do nome', when: (o) => !!o.name }
    ],
    text: [
      { k: 'text', t: 'textarea', label: 'Texto', ph: 'Nome da rua, número da casa…', rows: 2 },
      { k: 'color', t: 'color', label: 'Cor' },
      { k: 'size', t: 'number', label: 'Tamanho', min: 4, max: 160, scale: true },
      { k: 'rotation', t: 'range', label: 'Rotação (°)', min: -180, max: 180, step: 1 },
      { k: 'bold', t: 'toggle', label: 'Negrito' },
      { k: 'haloWidth', t: 'number', label: 'Contorno claro', min: 0, max: 20, scale: true },
      { k: 'halo', t: 'color', label: 'Cor do contorno', when: (o) => o.haloWidth > 0, swatches: false }
    ],
    marker: [
      { k: 'name', t: 'text', label: 'Rótulo', ph: 'Ex.: Escola Municipal' },
      { k: 'icon', t: 'icons', label: 'Símbolo' },
      { k: 'style', t: 'segmented', label: 'Estilo', options: [['pin', 'Círculo'], ['symbol', 'Só símbolo']] },
      { k: 'color', t: 'color', label: 'Cor' },
      { k: 'size', t: 'number', label: 'Tamanho', min: 6, max: 120, scale: true },
      { k: 'labelSize', t: 'number', label: 'Tamanho do rótulo', min: 4, max: 60, scale: true, when: (o) => !!o.name }
    ],
    focus: [
      { k: 'shape', t: 'segmented', label: 'Formato', options: [['rect', 'Retângulo'], ['ellipse', 'Oval']] },
      { k: 'name', t: 'text', label: 'Título (opcional)', ph: 'Aparece acima do foco' },
      { k: 'maskColor', t: 'color', label: 'Cor da área de fora' },
      { k: 'maskOpacity', t: 'range', label: 'Opacidade de fora', min: 0, max: 1, step: 0.05, pct: true },
      { k: 'stroke', t: 'color', label: 'Contorno' },
      { k: 'strokeWidth', t: 'number', label: 'Espessura do contorno', min: 0, max: 30, scale: true },
      { k: 'dashed', t: 'toggle', label: 'Contorno tracejado' }
    ],
    compass: [
      { k: 'color', t: 'color', label: 'Cor' },
      { k: 'size', t: 'number', label: 'Tamanho', min: 10, max: 300, scale: true },
      { k: 'rotation', t: 'range', label: 'Rotação (°)', min: -180, max: 180, step: 1 }
    ],
    legend: [
      { k: 'title', t: 'text', label: 'Título', ph: 'Legenda' },
      { k: 'auto', t: 'toggle', label: 'Montar automaticamente', help: 'Lista áreas com nome, ruas e símbolos usados no mapa.' },
      { k: 'text', t: 'textarea', label: 'Linhas extras', ph: 'Uma informação por linha', rows: 3 },
      { k: 'size', t: 'number', label: 'Tamanho do texto', min: 4, max: 60, scale: true },
      { k: 'color', t: 'color', label: 'Cor do texto' },
      { k: 'bg', t: 'color', label: 'Fundo', swatches: false },
      { k: 'bgOpacity', t: 'range', label: 'Opacidade do fundo', min: 0, max: 1, step: 0.05, pct: true },
      { k: 'borderWidth', t: 'number', label: 'Borda', min: 0, max: 10, step: 0.5, scale: true }
    ]
  };

  function displayName(obj) {
    if (obj.type === 'text') return (obj.text || 'Texto').split('\n')[0];
    if (obj.type === 'legend') return obj.title || 'Legenda';
    if (obj.name) return obj.name.split('\n')[0];
    if (obj.type === 'marker') return M.iconById(obj.icon).label;
    const same = S.doc.objects.filter((o) => o.type === obj.type);
    return M.TYPES[obj.type].label + (same.length > 1 ? ' ' + (same.indexOf(obj) + 1) : '');
  }

  function swatchFor(obj) {
    switch (obj.type) {
      case 'road': return { bg: obj.color };
      case 'area': return { bg: U.hexToRgba(obj.fill, Math.max(0.45, obj.fillOpacity)), border: obj.stroke };
      case 'marker': return { bg: obj.color, glyph: M.iconById(obj.icon).glyph || '●' };
      case 'text': return { bg: '#ffffff', glyph: 'T', color: obj.color };
      case 'focus': return { bg: '#ffffff', glyph: '◻', color: obj.stroke };
      case 'compass': return { bg: '#ffffff', glyph: 'N', color: obj.color };
      default: return { bg: obj.bg || '#ffffff', glyph: '≡', color: obj.color };
    }
  }

  /* ---------- Inspetor ---------- */

  const inspectorEl = () => document.getElementById('inspector');
  let inspectorKey = '';

  function renderInspector(force) {
    const el = inspectorEl();
    const obj = S.selected();
    const key = obj ? obj.id + '|' + S.sel.node : 'none';
    // Não recria os campos enquanto a pessoa digita: só atualiza os demais valores.
    if (!force && key === inspectorKey && el.contains(document.activeElement) && document.activeElement.matches('input:not([type=checkbox]):not([type=range]),textarea')) {
      syncValues(el, obj);
      return;
    }
    inspectorKey = key;
    if (!obj) { el.innerHTML = emptyInspector(); hydrateIcons(el); bindEmpty(el); return; }

    const locked = !!obj.locked;
    let html = '<div class="inspector-head"><div class="type-badge">' + icon(M.TYPES[obj.type].icon) + '</div><div class="grow"><strong>' + esc(displayName(obj)) + '</strong><small>' + M.TYPES[obj.type].label + (obj.visible === false ? ' · oculto' : '') + (locked ? ' · bloqueado' : '') + '</small></div>' +
      '<button class="icon-btn small" data-act="visible" title="' + (obj.visible === false ? 'Mostrar' : 'Ocultar') + '">' + icon(obj.visible === false ? 'eyeOff' : 'eye') + '</button>' +
      '<button class="icon-btn small" data-act="lock" title="' + (locked ? 'Desbloquear' : 'Bloquear') + '">' + icon(locked ? 'lock' : 'unlock') + '</button></div>';

    if (locked) html += '<div class="callout warn">' + icon('lock') + '<div>Item bloqueado: não pode ser movido nem editado. <button class="link" data-act="lock">Desbloquear</button></div></div>';
    if (obj.visible === false) html += '<div class="callout">' + icon('eyeOff') + '<div>Item oculto: não aparece no mapa nem na exportação. <button class="link" data-act="visible">Mostrar</button></div></div>';

    if (S.isPath(obj) && S.sel.node && obj.points.includes(S.sel.node)) html += vertexSection(obj, locked);
    if (S.isPath(obj) && !S.sel.node && !locked) {
      html += '<div class="callout">' + icon('info') + '<div>Arraste os pontos para ajustar. Arraste os pontos menores do meio para criar curvas. Solte um ponto sobre outro para conectar.</div></div>';
    }

    html += '<div class="section">' + SCHEMA[obj.type].filter((f) => !f.when || f.when(obj)).map((f) => fieldHtml(f, obj, locked)).join('') + '</div>';
    html += actionsSection(obj, locked);
    el.innerHTML = html;
    bindInspector(el, obj);
  }

  function vertexSection(obj, locked) {
    const nodeId = S.sel.node;
    const usage = S.nodeUsage(nodeId);
    const idx = obj.points.indexOf(nodeId);
    const canSplit = obj.type === 'road' && idx > 0 && idx < obj.points.length - 1;
    const canRemove = obj.points.length > M.MIN_POINTS[obj.type];
    let html = '<div class="section"><h3>Ponto selecionado</h3>';
    html += '<p class="note">' + (usage > 1 ? 'Junção real: este ponto liga ' + usage + ' itens. Movê-lo move todos juntos.' : 'Ponto ' + (idx + 1) + ' de ' + obj.points.length + '. Solte-o sobre outro ponto para criar uma junção.') + '</p>';
    html += '<div class="actions">';
    html += '<button class="btn" data-act="removeVertex"' + (locked || !canRemove ? ' disabled' : '') + '>' + icon('trash') + 'Remover</button>';
    html += '<button class="btn" data-act="detach"' + (locked || usage < 2 ? ' disabled' : '') + '>' + icon('unlink') + 'Desligar</button>';
    if (obj.type === 'road') html += '<button class="btn" data-act="split"' + (locked || !canSplit ? ' disabled' : '') + '>' + icon('scissors') + 'Dividir</button>';
    html += '</div></div>';
    return html;
  }

  function actionsSection(obj, locked) {
    let extra = '';
    if (obj.type === 'road' && obj.name && obj.showLabel) {
      extra += obj.labelAt
        ? '<button class="btn block" data-act="labelAuto" style="margin-bottom:8px">' + icon('target') + 'Voltar o nome ao lugar automático</button>'
        : '<p class="note" style="margin:0 0 8px">Dica: arraste o nome da rua no mapa para mudar a posição dele.</p>';
    }
    if (obj.type === 'road') {
      extra += '<button class="btn block" data-act="crossOne" style="margin-bottom:8px"' + (locked ? ' disabled' : '') + '>' + icon('cross') + 'Criar junções onde esta rua cruza outras</button>';
      const roads = S.doc.objects.filter((o) => o.type === 'road' && o.id !== obj.id);
      const same = roads.filter((o) => o.color === obj.color).length;
      if (roads.length) {
        extra += '<p class="note" style="margin:4px 0 6px">Copiar o estilo desta rua (cores, largura, contorno e nome):</p><div class="actions" style="grid-template-columns:1fr 1fr;margin-bottom:8px">' +
          '<button class="btn" data-act="styleSame"' + (same ? '' : ' disabled') + ' title="Ruas com a mesma cor desta">' + icon('copy') + 'Desta cor</button>' +
          '<button class="btn" data-act="styleAll">' + icon('copy') + 'Todas as ruas</button></div>';
      }
    }
    if (M.isBlock(obj)) extra += '<button class="btn block" data-act="numberTouch" style="margin-bottom:8px">' + icon('cursor') + 'Renumerar quadras tocando</button>';
    if (obj.type === 'focus' || obj.type === 'area') extra += '<button class="btn block" data-act="frameTo" style="margin-bottom:8px">' + icon('crop') + 'Enquadrar o cartão neste ' + (obj.type === 'focus' ? 'foco' : 'território') + '</button>';
    return '<div class="section"><h3>Ações</h3>' + extra + '<div class="actions">' +
      '<button class="btn" data-act="duplicate" title="Ctrl+D">' + icon('copy') + 'Duplicar</button>' +
      '<button class="btn" data-act="front" title="Trazer para frente">' + icon('up') + 'Frente</button>' +
      '<button class="btn" data-act="back" title="Enviar para trás">' + icon('down') + 'Trás</button>' +
      '</div><button class="btn danger block" data-act="delete" style="margin-top:8px"' + (locked ? ' disabled' : '') + '>' + icon('trash') + 'Excluir</button></div>';
  }

  function syncValues(el, obj) {
    if (!obj) return;
    el.querySelectorAll('[data-k]').forEach((input) => {
      if (input === document.activeElement) return;
      const v = obj[input.dataset.k];
      if (input.type === 'checkbox') input.checked = !!v;
      else if (v != null) input.value = v;
    });
  }

  function readValue(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.dataset.num) return Number(input.value);
    return input.value;
  }

  function bindInspector(el, obj) {
    const id = obj.id;
    el.querySelectorAll('[data-k]').forEach((input) => {
      const k = input.dataset.k;
      const apply = () => {
        const v = readValue(input);
        S.update(id, { [k]: v }, 'insp:' + id + ':' + k);
        const out = input.closest('.field') && input.closest('.field').querySelector('output');
        if (out && input.type === 'range') {
          const f = findField(obj.type, k);
          out.textContent = f && f.pct ? Math.round(v * 100) + '%' : fmtNum(v);
        }
      };
      input.addEventListener('input', apply);
      input.addEventListener('change', () => { apply(); S.breakMerge(); renderInspector(true); });
    });
    el.querySelectorAll('[data-swatch]').forEach((b) => b.addEventListener('click', () => {
      S.update(id, { [b.dataset.swatch]: b.dataset.color });
      S.breakMerge();
      renderInspector(true);
    }));
    el.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => {
      S.update(id, { [b.dataset.seg]: b.dataset.val });
      S.breakMerge();
      renderInspector(true);
    }));
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => A().objectAction(b.dataset.act, id)));
  }

  function findField(type, k) {
    for (const f of SCHEMA[type]) {
      if (f.k === k) return f;
      if (f.items) { const g = f.items.find((i) => i.k === k); if (g) return g; }
    }
    return null;
  }

  function emptyInspector() {
    const objs = S.doc.objects;
    const count = (t) => objs.filter((o) => o.type === t).length;
    const roads = count('road');
    return '<div class="empty">' + icon('cursor') + '<strong>Nada selecionado</strong><p>Toque em um item no mapa para editar, ou escolha uma ferramenta para desenhar.</p>' +
      (roads > 1 ? '<button class="btn small" data-empty="cross">' + icon('cross') + 'Criar junções nos cruzamentos</button>' : '') +
      '<div class="stats"><div class="stat"><b>' + roads + '</b><span>ruas</span></div><div class="stat"><b>' + count('area') + '</b><span>áreas</span></div><div class="stat"><b>' + (count('marker') + count('text')) + '</b><span>anotações</span></div></div></div>' +
      '<div class="section kbd-only"><h3>Atalhos úteis</h3><div class="shortcut-list">' +
      '<span><kbd>R</kbd></span><span>Desenhar rua</span><span><kbd>A</kbd></span><span>Desenhar área</span>' +
      '<span><kbd>Enter</kbd></span><span>Concluir desenho</span><span><kbd>Esc</kbd></span><span>Cancelar / voltar a selecionar</span>' +
      '<span><kbd>Espaço</kbd></span><span>Segure para mover o mapa</span><span><kbd>Ctrl</kbd>+<kbd>V</kbd></span><span>Colar print como mapa base</span>' +
      '</div><p class="note" style="margin-top:10px"><button class="link" data-empty="shortcuts">Ver todos os atalhos</button></p></div>';
  }

  function bindEmpty(el) {
    const cross = el.querySelector('[data-empty="cross"]');
    if (cross) cross.onclick = () => A().crossAll();
    const sc = el.querySelector('[data-empty="shortcuts"]');
    if (sc) sc.onclick = openShortcuts;
  }

  /* ---------- Camadas ---------- */

  function renderLayers() {
    const el = document.getElementById('layers');
    const objs = S.doc.objects;
    document.getElementById('layerCount').textContent = objs.length ? objs.length : '';
    let html = '';
    M.GROUPS.forEach((g) => {
      const list = objs.filter((o) => g.types.includes(o.type)).reverse();
      if (!list.length) return;
      html += '<div class="layer-group-title">' + g.label + '</div>';
      list.forEach((o) => {
        const sw = swatchFor(o);
        html += '<div class="layer' + (o.id === S.sel.id ? ' selected' : '') + (o.visible === false ? ' is-hidden' : '') + '" data-id="' + o.id + '" tabindex="0" role="button">' +
          '<span class="layer-swatch" style="background:' + sw.bg + ';' + (sw.border ? 'border:2px solid ' + sw.border + ';' : '') + (sw.color ? 'color:' + sw.color + ';' : '') + '">' + esc(sw.glyph || '') + '</span>' +
          '<span class="layer-name">' + esc(displayName(o)) + '</span>' +
          '<button class="icon-btn small ' + (o.visible === false ? 'warn' : '') + '" data-layer="visible" title="' + (o.visible === false ? 'Mostrar' : 'Ocultar') + '">' + icon(o.visible === false ? 'eyeOff' : 'eye') + '</button>' +
          '<button class="icon-btn small ' + (o.locked ? 'on' : '') + '" data-layer="lock" title="' + (o.locked ? 'Desbloquear' : 'Bloquear') + '">' + icon(o.locked ? 'lock' : 'unlock') + '</button></div>';
      });
    });
    const b = S.doc.base;
    html += '<div class="layer-group-title">Mapa base</div><div class="layer' + (b.visible ? '' : ' is-hidden') + '" data-base="1">' +
      '<span class="layer-swatch" style="background:var(--surface-3);color:var(--muted)">' + icon('image') + '</span>' +
      '<span class="layer-name">' + (b.imageId ? 'Imagem do mapa' : 'Sem mapa base') + (b.imageId ? '<small>' + b.width + '×' + b.height + '</small>' : '') + '</span>' +
      (b.imageId ? '<button class="icon-btn small ' + (b.visible ? '' : 'warn') + '" data-layer="baseVisible" title="' + (b.visible ? 'Ocultar' : 'Mostrar') + '">' + icon(b.visible ? 'eye' : 'eyeOff') + '</button>' : '') + '</div>';
    if (!objs.length) html = '<div class="empty">' + icon('layers') + '<strong>Nenhum item ainda</strong><p>Tudo que você desenhar aparece aqui, organizado por tipo.</p></div>' + html;
    el.innerHTML = html;
  }

  function bindLayers() {
    const el = document.getElementById('layers');
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-layer]');
      const row = e.target.closest('.layer');
      if (!row) return;
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.layer === 'baseVisible') { S.setDocField('base.visible', !S.doc.base.visible); return; }
        A().objectAction(btn.dataset.layer, row.dataset.id);
        return;
      }
      if (row.dataset.id) A().selectAndReveal(row.dataset.id);
      else if (row.dataset.base) switchTab('settings');
    });
    el.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.layer[data-id]');
      if (row) A().zoomToObject(row.dataset.id);
    });
    el.addEventListener('keydown', (e) => {
      const row = e.target.closest('.layer[data-id]');
      if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); A().selectAndReveal(row.dataset.id); }
    });
  }

  /* ---------- Ajustes do mapa ---------- */

  function renderSettings() {
    const el = document.getElementById('settings');
    if (el.contains(document.activeElement) && ['range', 'color'].includes(document.activeElement.type)) return;
    const d = S.doc;
    const b = d.base;
    const preset = M.FRAMES[d.frame.preset] || M.FRAMES.card;
    let html = '';
    if (!App.storage.isPersistent()) html += '<div class="callout warn">' + icon('alert') + '<div>Este navegador não permite salvar automaticamente (modo privado?). Use <b>Exportar › Backup</b> para não perder o trabalho.</div></div>';

    html += '<div class="section"><h3>Cartão</h3><div class="field"><label for="framePreset">Formato de impressão</label><select class="select" id="framePreset">' +
      Object.keys(M.FRAMES).map((k) => '<option value="' + k + '"' + (k === d.frame.preset ? ' selected' : '') + '>' + M.FRAMES[k].label + '</option>').join('') + '</select></div>' +
      '<p class="note">A área do cartão é exatamente o que será exportado e impresso (' + String(preset.w).replace('.', ',') + ' × ' + String(preset.h).replace('.', ',') + ' cm). Use a ferramenta <b>Cartão</b> para movê-la ou redimensioná-la.</p>' +
      '<div class="actions" style="grid-template-columns:1fr 1fr"><button class="btn" data-set="frameTool">' + icon('crop') + 'Ajustar</button><button class="btn" data-set="frameView">' + icon('target') + 'Usar a tela</button></div>' +
      '<label class="toggle" style="margin-top:8px"><span>Escurecer fora do cartão</span><input type="checkbox" data-doc="settings.dimOutside"' + (d.settings.dimOutside ? ' checked' : '') + ' /><span class="track"></span></label></div>';

    html += '<div class="section"><h3>Mapa base</h3>';
    if (d.geo && d.geo.source === 'openfreemap') html += '<p class="note">Cartão criado pelo mapa' + (d.geo.angle ? ' (girado ' + Math.round(d.geo.angle) + '°; a seta do Norte mostra a direção)' : '') + '. Ruas, quadras e referências são itens normais: edite à vontade.</p>';
    if (b.imageId) {
      html += '<label class="toggle"><span>Mostrar mapa base</span><input type="checkbox" data-doc="base.visible"' + (b.visible ? ' checked' : '') + ' /><span class="track"></span></label>' +
        '<div class="field"><label for="baseOpacity">Intensidade <output>' + Math.round(b.opacity * 100) + '%</output></label><input type="range" id="baseOpacity" data-doc="base.opacity" min="0.1" max="1" step="0.05" value="' + b.opacity + '" /></div>' +
        '<label class="toggle"><span>Preto e branco<small>Destaca as ruas desenhadas</small></span><input type="checkbox" data-doc="base.grayscale"' + (b.grayscale ? ' checked' : '') + ' /><span class="track"></span></label>' +
        (b.attribution ? '<p class="note">Fonte: ' + esc(b.attribution) + ' (incluída na exportação)</p>' : '') +
        '<div class="actions" style="grid-template-columns:1fr 1fr;margin-top:8px"><button class="btn" data-set="replaceImage">' + icon('image') + 'Trocar imagem</button><button class="btn" data-set="osm">' + icon('globe') + 'Buscar no mapa</button></div>' +
        '<button class="btn danger block" style="margin-top:8px" data-set="removeBase">' + icon('trash') + 'Remover mapa base</button>';
    } else {
      html += '<p class="note">Sem mapa de fundo. Use um print ou capture uma região do OpenStreetMap.</p><div class="actions" style="grid-template-columns:1fr 1fr"><button class="btn" data-set="replaceImage">' + icon('image') + 'Usar imagem</button><button class="btn" data-set="osm">' + icon('globe') + 'Buscar no mapa</button></div>';
    }
    html += '</div>';

    html += groupSections(d);

    html += '<div class="section"><h3>Novo cartão</h3><p class="note">Marque as quadras no mapa e o cartão é montado sozinho, num mapa novo.</p><button class="btn block" data-set="territory">' + icon('wand') + 'Criar pelo mapa</button>' +
      '<button class="btn block" style="margin-top:8px" data-set="overview">' + icon('globe') + 'Ver o mapa geral dos territórios</button></div>';

    html += '<div class="section"><h3>Desenho</h3>' +
      '<label class="toggle"><span>Encaixar em pontos e ruas próximas<small>Segure Alt para desativar na hora</small></span><input type="checkbox" data-doc="settings.snap"' + (d.settings.snap ? ' checked' : '') + ' /><span class="track"></span></label>' +
      '<label class="toggle"><span>Junções automáticas<small>Ao concluir uma rua, liga os cruzamentos</small></span><input type="checkbox" data-doc="settings.autoCross"' + (d.settings.autoCross ? ' checked' : '') + ' /><span class="track"></span></label>' +
      '<label class="toggle"><span>Mostrar pontos de junção</span><input type="checkbox" data-doc="settings.showNodes"' + (d.settings.showNodes ? ' checked' : '') + ' /><span class="track"></span></label></div>';

    html += '<div class="section"><h3>Versões</h3><p class="note">O mapa é salvo automaticamente a cada alteração. Versões são pontos de retorno: uma é criada a cada 10 minutos de edição.</p>' +
      '<button class="btn block" data-set="saveVersion">' + icon('history') + 'Salvar versão agora</button><div id="versionList" style="margin-top:8px"></div></div>';

    el.innerHTML = html;
    bindSettings(el);
    renderVersions();
  }

  // Ajustes em grupo: todas as ruas e todas as quadras de uma vez.
  function mostCommon(objs, k) {
    const count = new Map();
    objs.forEach((o) => count.set(o[k], (count.get(o[k]) || 0) + 1));
    let best = null, n = -1;
    count.forEach((c, v) => { if (c > n) { n = c; best = v; } });
    return best || '#000000';
  }

  function groupSections(d) {
    const step = (label, target, key) => '<div class="step-row"><span>' + label + '</span><button class="icon-btn small" data-step="' + target + ':' + key + ':-1" aria-label="Diminuir ' + label + '">' + icon('minus') + '</button><button class="icon-btn small" data-step="' + target + ':' + key + ':1" aria-label="Aumentar ' + label + '">' + icon('plus') + '</button></div>';
    const color = (label, target, key, objs) => '<label class="color-cell"><input type="color" data-gcolor="' + target + ':' + key + '" value="' + esc(mostCommon(objs, key)) + '" /><span>' + label + '</span></label>';
    let html = '';
    const roads = d.objects.filter((o) => o.type === 'road');
    if (roads.length) {
      const VM = App.vectormap;
      html += '<div class="section"><h3>Ruas</h3>' +
        '<p class="note">Todas de uma vez (o − e o + mantêm a diferença entre avenidas e ruas):</p>' +
        step('Largura', 'roads', 'width') + step('Contorno', 'roads', 'casing') + step('Tamanho dos nomes', 'roads', 'labelSize') +
        '<div class="color-row">' + color('Ruas', 'roads', 'color', roads) + color('Contorno', 'roads', 'casingColor', roads) + color('Nomes', 'roads', 'labelColor', roads) + '</div>';
      // Por tipo: avenidas, ruas principais, ruas, vielas e as desenhadas à mão
      const groups = VM.ROAD_GROUPS.map((g) => ({ g, list: roads.filter((o) => VM.roadGroupOf(o) === g.id) })).filter((x) => x.list.length);
      if (groups.length > 1 || (groups[0] && groups[0].g.id !== 'manual')) {
        html += '<h4 class="sub-h">Por tipo</h4>' + groups.map(({ g, list }) =>
          '<div class="type-block"><div class="type-head">' +
          '<input type="color" data-gcolor="rg-' + g.id + ':color" value="' + esc(mostCommon(list, 'color')) + '" title="Cor de ' + g.label.toLowerCase() + '" aria-label="Cor de ' + g.label.toLowerCase() + '" />' +
          '<strong>' + g.label + '</strong></div>' +
          '<div class="type-steps">' + step('Largura', 'rg-' + g.id, 'width') + step('Nome', 'rg-' + g.id, 'labelSize') + '</div></div>').join('');
      }
      if (d.geo && d.geo.source === 'openfreemap') {
        const has = !!App.storage.getPrefs().roadDefaults;
        html += '<button class="btn block" style="margin-top:10px" data-roads="saveDefault">' + icon('save') + 'Usar como padrão nos próximos cartões</button>' +
          (has ? '<button class="link" style="margin-top:6px" data-roads="resetDefault">Voltar ao padrão original</button>' : '');
      }
      html += '</div>';
    }
    const blocks = d.objects.filter(M.isBlock);
    if (blocks.length) {
      html += '<div class="section"><h3>Quadras <span class="count">' + blocks.length + '</span></h3>' +
        '<div class="actions" style="grid-template-columns:1fr 1fr;margin-bottom:6px"><button class="btn" data-blocks="touch" title="Toque nas quadras na nova ordem">' + icon('cursor') + 'Numerar tocando</button>' +
        '<button class="btn" data-blocks="seq" title="Ex.: 1, 2, 4, 5 vira 1, 2, 3, 4">' + icon('history') + 'Fechar buracos</button></div>' +
        step('Tamanho dos números', 'blocks', 'labelSize') +
        '<div class="color-row">' + color('Quadras', 'blocks', 'fill', blocks) + color('Números', 'blocks', 'labelColor', blocks) + '</div></div>';
    }
    return html;
  }

  function bindSettings(el) {
    el.querySelector('#framePreset').addEventListener('change', (e) => A().setFramePreset(e.target.value));
    el.querySelectorAll('[data-doc]').forEach((input) => {
      const path = input.dataset.doc;
      const apply = () => {
        const v = input.type === 'checkbox' ? input.checked : Number(input.value);
        S.setDocField(path, v);
        const out = input.closest('.field') && input.closest('.field').querySelector('output');
        if (out) out.textContent = Math.round(v * 100) + '%';
      };
      input.addEventListener(input.type === 'range' ? 'input' : 'change', apply);
      if (input.type === 'range') input.addEventListener('change', () => S.breakMerge());
    });
    el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => A().settingsAction(b.dataset.set)));
    el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { const [t, k, dir] = b.dataset.step.split(':'); A().groupStep(t, k, +dir); }));
    el.querySelectorAll('[data-gcolor]').forEach((input) => {
      input.addEventListener('input', () => { const [t, k] = input.dataset.gcolor.split(':'); A().groupColor(t, k, input.value); });
      input.addEventListener('change', () => { S.breakMerge(); renderSettings(); });
    });
    el.querySelectorAll('[data-blocks]').forEach((b) => b.addEventListener('click', () => A().blocksAction(b.dataset.blocks)));
    el.querySelectorAll('[data-roads]').forEach((b) => b.addEventListener('click', () => A().roadDefaults(b.dataset.roads)));
    el.querySelectorAll('[data-roads]').forEach((b) => b.addEventListener('click', () => A().roadDefaults(b.dataset.roads)));
  }

  async function renderVersions() {
    const box = document.getElementById('versionList');
    if (!box) return;
    const list = await App.storage.listVersions(S.doc.id).catch(() => []);
    if (!list.length) { box.innerHTML = '<p class="note" style="margin:0">Nenhuma versão ainda.</p>'; return; }
    box.innerHTML = list.slice(0, 12).map((v) => '<div class="version"><div class="grow">' + esc(v.label) + '<small>' + U.formatDateTime(v.savedAt) + ' · ' + v.objects + ' itens</small></div><button class="btn small" data-version="' + v.id + '">Restaurar</button></div>').join('');
    box.querySelectorAll('[data-version]').forEach((b) => b.addEventListener('click', () => A().restoreVersion(b.dataset.version)));
  }

  /* ---------- Abas e painel ---------- */

  function switchTab(name) {
    document.querySelectorAll('.tabs [role="tab"]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-body').forEach((b) => { b.hidden = b.dataset.body !== name; });
    document.getElementById('panel').classList.remove('collapsed');
    if (name === 'settings') renderSettings();
    App.editor && App.editor.resize();
  }

  function currentTab() {
    const t = document.querySelector('.tabs [role="tab"].active');
    return t ? t.dataset.tab : 'item';
  }

  /* ---------- Galeria de mapas ---------- */

  async function openProjects() {
    const body = h('<div><div class="dlg-actions" style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap"></div><div class="gallery"></div></div>');
    const m = modal({ title: 'Meus mapas', body, className: 'projects-dialog', foot: false });
    m.dlg.style.width = 'min(920px, calc(100vw - 24px))';
    const bar = body.querySelector('.dlg-actions');
    const add = h('<button class="btn primary">' + icon('plus') + 'Novo mapa</button>');
    add.onclick = () => { m.close(); A().newProject(); };
    const imp = h('<button class="btn">' + icon('upload') + 'Abrir backup .json</button>');
    imp.onclick = () => { m.close(); A().pickJson(); };
    const ov = h('<button class="btn">' + icon('globe') + 'Mapa geral</button>');
    ov.onclick = () => { m.close(); App.overview.open(); };
    bar.append(add, ov, imp);

    const grid = body.querySelector('.gallery');
    const draw = async () => {
      const list = await App.storage.listProjects();
      if (!list.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' + icon('folder') + '<strong>Nenhum mapa salvo</strong><p>Os mapas ficam guardados neste navegador.</p></div>'; hydrateIcons(grid); return; }
      grid.innerHTML = list.map((p) => '<div class="card' + (p.id === S.doc.id ? ' current' : '') + '" data-id="' + p.id + '" tabindex="0">' +
        '<div class="card-thumb" style="' + (p.thumb ? 'background-image:url(' + p.thumb + ')' : '') + '"></div>' +
        '<div class="card-body"><div class="grow"><strong>' + esc(p.name || 'Mapa sem nome') + '</strong><small>' + (p.id === S.doc.id ? 'Aberto agora · ' : '') + U.relativeTime(p.updatedAt) + ' · ' + p.objects + ' itens</small></div>' +
        '<button class="icon-btn small" data-card="duplicate" title="Duplicar">' + icon('copy') + '</button>' +
        '<button class="icon-btn small" data-card="json" title="Baixar backup">' + icon('download') + '</button>' +
        '<button class="icon-btn small" data-card="delete" title="Excluir">' + icon('trash') + '</button></div></div>').join('');
    };
    grid.addEventListener('click', async (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const act = e.target.closest('[data-card]');
      const id = card.dataset.id;
      if (!act) { m.close(); A().openProject(id); return; }
      if (act.dataset.card === 'delete') {
        const ok = await confirmDialog({ title: 'Excluir mapa?', message: 'O mapa e todas as versões serão apagados deste navegador. Isso não pode ser desfeito.', ok: 'Excluir', danger: true });
        if (!ok) return;
        await A().deleteProject(id);
      } else if (act.dataset.card === 'duplicate') {
        await A().duplicateProject(id);
      } else if (act.dataset.card === 'json') {
        await A().exportProjectJson(id);
      }
      draw();
    });
    grid.addEventListener('keydown', (e) => {
      const card = e.target.closest('.card');
      if (card && e.key === 'Enter' && e.target === card) { m.close(); A().openProject(card.dataset.id); }
    });
    await A().saveNow();
    draw();
  }

  function openShortcuts() {
    const rows = [
      ['V', 'Selecionar e editar'], ['H', 'Mover o mapa (ou segure Espaço)'], ['R', 'Rua'], ['A', 'Área / território'], ['T', 'Texto'], ['P', 'Ponto de referência'],
      ['F', 'Foco'], ['N', 'Norte'], ['L', 'Legenda'], ['C', 'Ajustar o cartão'],
      ['Enter', 'Concluir rua/área'], ['Backspace', 'Desfazer o último ponto (desenhando)'], ['Esc', 'Cancelar / limpar seleção'],
      ['Shift', 'Ângulos de 15° ao desenhar · rotação em passos'], ['Alt', 'Desenhar sem encaixe'],
      ['Delete', 'Excluir item ou ponto selecionado'], ['Ctrl+D', 'Duplicar'], ['Setas', 'Mover item (Shift = 10×)'],
      ['Ctrl+Z', 'Desfazer'], ['Ctrl+Shift+Z', 'Refazer'], ['Ctrl+S', 'Salvar uma versão'], ['Ctrl+V', 'Colar print como mapa base'],
      ['+ / −', 'Zoom'], ['0', 'Ver o cartão inteiro']
    ];
    const body = '<div class="shortcut-list">' + rows.map(([k, d]) => '<span>' + k.split(' / ').map((x) => x.split('+').map((y) => '<kbd>' + esc(y) + '</kbd>').join('+')).join(' / ') + '</span><span>' + d + '</span>').join('') + '</div>' +
      '<p class="note" style="margin-top:14px">No celular: toque para adicionar pontos, arraste com um dedo para mover o mapa e use dois dedos para zoom.</p>';
    const m = modal({ title: 'Atalhos', body, foot: false });
    m.dlg.style.width = 'min(520px, calc(100vw - 24px))';
  }

  App.ui = {
    icon, hydrateIcons, toast, modal, confirm: confirmDialog, prompt: promptDialog,
    renderInspector, renderLayers, renderSettings, renderVersions, bindLayers, switchTab, currentTab,
    openProjects, openShortcuts, displayName
  };
})();
