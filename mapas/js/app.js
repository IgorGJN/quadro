/* Inicialização e ações do aplicativo. */
(function () {
  'use strict';

  const App = window.App;
  const U = App.util;
  const M = App.model;
  const S = App.store;
  const R = App.render;
  const UI = App.ui;
  const ST = App.storage;
  const E = App.editor;

  const VERSION_EVERY = 10 * 60 * 1000;
  const $ = (id) => document.getElementById(id);

  let lastVersionAt = Date.now();
  let dirtySinceVersion = false;
  let saveErrorShown = false;
  let uiQueued = false;

  /* ---------- Salvamento automático ---------- */

  const hasContent = (d) => !!(d.base.imageId || d.objects.length || d.name);

  function setStatus(text, error) {
    const el = $('saveStatus');
    el.textContent = text;
    el.classList.toggle('error', !!error);
  }

  function thumbnail(doc) {
    try { return R.renderFrame(doc, 420).toDataURL('image/jpeg', 0.72); } catch (e) { return null; }
  }

  async function saveNow() {
    const doc = S.doc;
    if (!doc || !hasContent(doc)) return;
    try {
      await ST.putProject(doc, thumbnail(doc));
      ST.setPrefs({ lastProjectId: doc.id });
      setStatus(ST.isPersistent() ? 'Salvo ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Não salvo (modo temporário)', !ST.isPersistent());
      if (dirtySinceVersion && Date.now() - lastVersionAt > VERSION_EVERY) {
        await ST.addVersion(doc, 'Automática');
        lastVersionAt = Date.now();
        dirtySinceVersion = false;
      }
      saveErrorShown = false;
    } catch (err) {
      console.error(err);
      setStatus('Erro ao salvar', true);
      if (!saveErrorShown) {
        saveErrorShown = true;
        UI.toast('Não foi possível salvar neste navegador. Faça um backup em Exportar.', { type: 'error', duration: 6000 });
      }
    }
  }

  const scheduleSave = U.debounce(saveNow, 700);

  /* ---------- Atualização da interface ---------- */

  function scheduleUi() {
    if (uiQueued) return;
    uiQueued = true;
    requestAnimationFrame(() => { uiQueued = false; refreshUi(); });
  }

  function refreshUi() {
    if (!S.doc) return;
    $('undoBtn').disabled = !S.canUndo();
    $('redoBtn').disabled = !S.canRedo();
    if (E.busy) return; // durante arrastos só o desenho é atualizado
    const name = $('projectName');
    if (document.activeElement !== name) name.value = S.doc.name || '';
    document.title = (S.doc.name ? S.doc.name + ' · ' : '') + 'Mapas de Território';
    const tab = UI.currentTab();
    if (tab === 'item') UI.renderInspector();
    UI.renderLayers();
    if (tab === 'settings') UI.renderSettings();
    updateStart();
  }

  function updateStart() {
    const d = S.doc;
    $('startScreen').hidden = !!(d.base.imageId || d.objects.length || d._blank);
  }

  S.on((kind) => {
    if (kind === 'doc') {
      dirtySinceVersion = true;
      if (hasContent(S.doc)) setStatus('Salvando…');
      scheduleSave();
    }
    if (kind === 'select' && S.sel.id && UI.currentTab() !== 'item' && UI.currentTab() !== 'layers') UI.switchTab('item');
    E.requestDraw();
    scheduleUi();
  });

  /* ---------- Documento ---------- */

  async function ensureImage(doc) {
    const id = doc.base.imageId;
    if (!id || App.images.get(id)) return;
    const dataUrl = await ST.getImage(id).catch(() => null);
    if (!dataUrl) { doc.base.imageId = null; return; }
    try { await App.images.add(id, dataUrl); } catch (e) { doc.base.imageId = null; }
  }

  async function loadDoc(doc) {
    await ensureImage(doc);
    if (doc._needsFrame) { M.fitFrame(doc); delete doc._needsFrame; }
    S.setDoc(doc);
    lastVersionAt = Date.now();
    dirtySinceVersion = false;
    E.cancelDraft();
    E.setTool('select');
    E.fitFrame();
    UI.renderInspector(true);
    refreshUi();
    setStatus(hasContent(doc) ? 'Salvo' : '');
    ST.setPrefs({ lastProjectId: doc.id });
    if (hasContent(doc)) scheduleSave(); // atualiza a miniatura (ex.: mapas importados)
  }

  async function setBaseImage(dataUrl, opts) {
    const o = opts || {};
    let norm;
    try { norm = await U.normalizeImageDataUrl(dataUrl, 6000); }
    catch (e) { UI.toast('Não foi possível ler essa imagem.', { type: 'error' }); return; }
    const id = U.uid('img');
    await App.images.add(id, norm.dataUrl, norm.img);
    try { await ST.putImage(id, norm.dataUrl); } catch (e) { console.warn(e); }
    const d = S.doc;
    const k = norm.img.naturalWidth / (o.width || norm.img.naturalWidth);
    S.checkpoint();
    d.base = Object.assign({}, d.base, { imageId: id, width: norm.img.naturalWidth, height: norm.img.naturalHeight, visible: true, attribution: o.attribution || '' });
    if (o.geo) {
      // Captura do OpenStreetMap: guarda onde a imagem fica no mundo (Mapa geral)
      const s = App.vectormap.WORLD / (256 * Math.pow(2, o.geo.z));
      const a = s / (k * o.geo.ts);
      d.geo = { source: 'osm-image', toG: [a, 0, 0, a, o.geo.ox * s, o.geo.oy * s] };
    }
    if (o.frame) {
      const r = M.frameRatio(d);
      const f = { x: o.frame.x * k, y: o.frame.y * k, w: o.frame.w * k, h: o.frame.h * k };
      const w = Math.min(f.w, f.h * r);
      d.frame = Object.assign({}, d.frame, { x: f.x + (f.w - w) / 2, y: f.y + (f.h - w / r) / 2, w, h: w / r });
    } else if (!d.objects.length) {
      M.fitFrame(d);
    }
    S.changed();
    E.fitFrame();
    UI.toast(d.objects.length ? 'Mapa base atualizado.' : 'Mapa pronto! Escolha "Rua" ou "Área" para começar a desenhar.', { type: 'ok', duration: 4000 });
  }

  async function handleImageFile(file) {
    if (!file || !/^image\//.test(file.type)) { UI.toast('Escolha um arquivo de imagem (PNG, JPG…).'); return; }
    if (S.doc.base.imageId) {
      const ok = await UI.confirm({ title: 'Substituir o mapa base?', message: 'A imagem atual será trocada. Os itens desenhados continuam nas mesmas posições (dá para desfazer).', ok: 'Substituir' });
      if (!ok) return;
    }
    const dataUrl = await U.readFile(file);
    await setBaseImage(dataUrl);
  }

  async function importProjectFile(file) {
    try {
      const text = await U.readFile(file, 'text');
      const parsed = ST.parseProjectFile(text);
      const doc = parsed.doc;
      const existing = await ST.getProject(doc.id);
      if (existing) doc.id = U.uid('map');
      if (parsed.imageDataUrl) {
        const norm = await U.normalizeImageDataUrl(parsed.imageDataUrl, 6000);
        const id = U.uid('img');
        await App.images.add(id, norm.dataUrl, norm.img);
        await ST.putImage(id, norm.dataUrl);
        Object.assign(doc.base, { imageId: id, width: norm.img.naturalWidth, height: norm.img.naturalHeight });
      } else {
        doc.base.imageId = null;
      }
      if (parsed.needsFrame) doc._needsFrame = true;
      await saveNow();
      await loadDoc(doc);
      await saveNow();
      UI.toast('Mapa "' + (doc.name || 'sem nome') + '" aberto.', { type: 'ok' });
    } catch (err) {
      console.error(err);
      UI.toast(err.message || 'Arquivo inválido.', { type: 'error' });
    }
  }

  /* ---------- Exportação ---------- */

  function exportCanvas(hd) {
    const f = S.doc.frame;
    const ratio = f.w / f.h;
    let w = hd ? 5600 : 2800;
    // Limite seguro de pixels para celulares
    w = Math.min(w, Math.floor(Math.sqrt(16e6 * ratio)));
    return R.renderFrame(S.doc, w);
  }

  const fileBase = () => U.safeFileName(S.doc.name || 'mapa-territorio');

  async function doExport(kind) {
    const doc = S.doc;
    try {
      if (kind === 'png' || kind === 'png-hd') {
        const blob = await U.canvasToBlob(exportCanvas(kind === 'png-hd'));
        U.downloadBlob(fileBase() + '.png', blob);
        UI.toast('Imagem baixada.', { type: 'ok' });
      } else if (kind === 'copy') {
        if (!navigator.clipboard || !window.ClipboardItem) throw new Error('Copiar imagem não é suportado neste navegador. Use "Baixar imagem".');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': U.canvasToBlob(exportCanvas(false)) })]);
        UI.toast('Imagem copiada. Cole no WhatsApp, documento ou e-mail.', { type: 'ok' });
      } else if (kind === 'share') {
        const blob = await U.canvasToBlob(exportCanvas(false));
        const file = new File([blob], fileBase() + '.png', { type: 'image/png' });
        await navigator.share({ files: [file], title: doc.name || 'Mapa de território' });
      } else if (kind === 'print') {
        printCard();
      } else if (kind === 'json') {
        await ST.exportJson(doc);
        UI.toast('Backup baixado. Guarde esse arquivo para restaurar ou abrir em outro aparelho.', { type: 'ok', duration: 4000 });
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error(err);
      UI.toast(err.message || 'Não foi possível exportar.', { type: 'error' });
    }
  }

  // Imprime no tamanho físico do formato escolhido (ex.: 14 × 5,8 cm).
  function printCard() {
    const preset = M.FRAMES[S.doc.frame.preset] || M.FRAMES.card;
    const url = exportCanvas(false).toDataURL('image/png');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><title>' + U.escapeHtml(S.doc.name || 'Mapa') + '</title><style>@page{margin:10mm}html,body{margin:0}img{width:' + preset.w + 'cm;height:' + preset.h + 'cm;display:block;border:0.2mm solid #999}</style></head><body><img src="' + url + '"></body></html>';
    frame.onload = () => {
      const w = frame.contentWindow;
      const img = w.document.querySelector('img');
      const go = () => { w.focus(); w.print(); setTimeout(() => frame.remove(), 60000); };
      if (img.complete) go(); else img.onload = go;
    };
    document.body.appendChild(frame);
  }

  /* ---------- Ações ---------- */

  function revealIfHidden(id) {
    const o = S.get(id);
    if (!o) return;
    const b = R.objectBounds(o);
    const v = E.visibleWorld();
    const inside = b.x + b.w > v.x && b.x < v.x + v.w && b.y + b.h > v.y && b.y < v.y + v.h;
    if (!inside) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      E.view.ox += (v.x + v.w / 2 - cx) * E.view.scale;
      E.view.oy += (v.y + v.h / 2 - cy) * E.view.scale;
      E.requestDraw();
    }
  }

  const actions = {
    saveNow: () => { scheduleSave.cancel(); return saveNow(); },

    objectAction(act, id) {
      const o = S.get(id);
      if (!o) return;
      switch (act) {
        case 'visible': S.update(id, { visible: o.visible === false }, null); break;
        case 'lock': S.update(id, { locked: !o.locked }, null); break;
        case 'duplicate': S.duplicate(id); break;
        case 'front': if (!S.reorder(id, 1)) UI.toast('Já está na frente do seu grupo.'); break;
        case 'back': if (!S.reorder(id, -1)) UI.toast('Já está atrás no seu grupo.'); break;
        case 'delete':
          if (o.locked) { UI.toast('Desbloqueie o item para excluir.'); return; }
          S.remove(id);
          UI.toast(M.TYPES[o.type].label + ' excluído.', { action: { label: 'Desfazer', fn: () => S.undo() } });
          break;
        case 'removeVertex':
          if (o.locked) return;
          if (!S.removeVertex(id, S.sel.node)) UI.toast(o.type === 'road' ? 'A rua precisa de pelo menos 2 pontos.' : 'A área precisa de pelo menos 3 pontos.');
          break;
        case 'detach':
          if (S.detachNode(id, S.sel.node)) UI.toast('Ponto desligado. Arraste-o para separar.');
          break;
        case 'split':
          if (S.splitRoad(id, S.sel.node)) UI.toast('Rua dividida em duas, ligadas neste ponto.', { type: 'ok' });
          break;
        case 'crossOne': {
          S.checkpoint();
          const n = S.crossRoads([id], 3 / E.view.scale);
          if (n) { S.changed(); UI.toast(n + (n === 1 ? ' junção criada.' : ' junções criadas.'), { type: 'ok' }); }
          else { S.dropLastCheckpoint(); UI.toast('Nenhum cruzamento novo encontrado.'); }
          break;
        }
        case 'styleSame':
        case 'styleAll': {
          const keys = ['color', 'width', 'casing', 'casingColor', 'labelSize', 'labelColor', 'dashed', 'smooth', 'rounded'];
          const targets = S.doc.objects.filter((r) => r.type === 'road' && r.id !== o.id && (act === 'styleAll' || r.color === o.color));
          const n = S.updateMany(targets, (r) => keys.forEach((k) => { r[k] = o[k]; }));
          if (n) UI.toast(act === 'styleAll' ? 'Estilo copiado para todas as ruas.' : 'Estilo copiado para as ruas desta cor.', { type: 'ok', action: { label: 'Desfazer', fn: () => S.undo() } });
          break;
        }
        case 'numberTouch':
          E.startNumbering();
          break;
        case 'frameTo': {
          const b = R.objectBounds(o);
          const r = M.frameRatio();
          const pad = Math.max(b.w, b.h) * 0.08;
          let w = Math.max(b.w + pad * 2, (b.h + pad * 2) * r);
          S.checkpoint();
          S.doc.frame = Object.assign({}, S.doc.frame, { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - w / r / 2, w, h: w / r });
          S.changed();
          E.fitFrame();
          UI.toast('Cartão enquadrado.', { type: 'ok' });
          break;
        }
      }
    },

    // − / + em todas as ruas ou quadras: multiplica, mantendo as proporções.
    groupStep(target, key, dir) {
      const objs = target === 'roads' ? S.doc.objects.filter((o) => o.type === 'road') : S.doc.objects.filter(M.isBlock);
      const f = dir > 0 ? 1.15 : 1 / 1.15;
      const k = S.sizeFactor();
      const min = { width: 1, casing: 0, labelSize: 4 }[key] * k;
      S.updateMany(objs, (o) => {
        let v = (o[key] || 0) * f;
        if (!o[key] && dir > 0) v = (key === 'casing' ? 1.5 : 4) * k; // contorno zerado volta a aparecer
        o[key] = Math.round(Math.max(min, v) * 10) / 10;
        if (key === 'labelSize' && o.type === 'road' && o.name) o.showLabel = true;
      }, 'group:' + target + ':' + key);
    },

    groupColor(target, key, value) {
      const objs = target === 'roads' ? S.doc.objects.filter((o) => o.type === 'road') : S.doc.objects.filter(M.isBlock);
      S.updateMany(objs, (o) => { o[key] = value; }, 'gcolor:' + target + ':' + key);
    },

    blocksAction(a) {
      if (a === 'touch') { E.startNumbering(); return; }
      if (a === 'seq') {
        const n = S.renumberBlocks();
        UI.toast(n ? 'Quadras numeradas de 1 a ' + n + '.' : 'A numeração já está em sequência.', n ? { type: 'ok', action: { label: 'Desfazer', fn: () => S.undo() } } : undefined);
      }
    },

    crossAll() {
      S.checkpoint();
      const n = S.crossRoads(null, 3 / E.view.scale);
      if (n) { S.changed(); UI.toast(n + (n === 1 ? ' cruzamento virou junção.' : ' cruzamentos viraram junções.'), { type: 'ok' }); }
      else { S.dropLastCheckpoint(); UI.toast('Nenhum cruzamento novo encontrado.'); }
    },

    selectAndReveal(id) {
      if (E.tool !== 'select') E.setTool('select');
      S.select(id);
      revealIfHidden(id);
    },

    zoomToObject(id) {
      const o = S.get(id);
      if (!o) return;
      const b = R.objectBounds(o);
      const pad = Math.max(b.w, b.h) * 0.3 + 10;
      E.zoomToRect({ x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 });
    },

    focusField(k) {
      UI.switchTab('item');
      UI.renderInspector(true);
      const el = document.querySelector('#inspector [data-k="' + k + '"]');
      if (el) { el.focus({ preventScroll: false }); if (el.select) el.select(); }
    },

    async settingsAction(a) {
      const d = S.doc;
      if (a === 'frameTool') { E.setTool('frame'); E.fitFrame(); return; }
      if (a === 'frameView') {
        const v = E.visibleWorld();
        const r = M.frameRatio();
        const w = Math.min(v.w, v.h * r) * 0.92;
        S.checkpoint();
        d.frame = Object.assign({}, d.frame, { x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 - w / r / 2, w, h: w / r });
        S.changed();
        E.fitFrame();
        UI.toast('O cartão agora mostra a área que estava na tela.', { type: 'ok' });
        return;
      }
      if (a === 'frameFit') { S.checkpoint(); M.fitFrame(d); S.changed(); E.fitFrame(); return; }
      if (a === 'replaceImage') { $('imageFile').click(); return; }
      if (a === 'osm') { App.osm.open(); return; }
      if (a === 'territory') { App.territory.open(); return; }
      if (a === 'overview') { App.overview.open(); return; }
      if (a === 'removeBase') {
        const ok = await UI.confirm({ title: 'Remover o mapa base?', message: 'Os itens desenhados continuam. Você pode desfazer.', ok: 'Remover', danger: true });
        if (!ok) return;
        S.checkpoint();
        d.base = Object.assign({}, d.base, { imageId: null, width: 0, height: 0, attribution: '' });
        S.changed();
        return;
      }
      if (a === 'saveVersion') {
        const label = await UI.prompt({ title: 'Salvar versão', message: 'Dê um nome para encontrar depois (opcional).', placeholder: 'Ex.: Antes de redesenhar a quadra 3', ok: 'Salvar' });
        if (label === null) return;
        await saveNow();
        await ST.addVersion(d, label || 'Manual');
        lastVersionAt = Date.now();
        dirtySinceVersion = false;
        UI.toast('Versão salva.', { type: 'ok' });
        UI.renderVersions();
      }
    },

    setFramePreset(preset) {
      const f = S.doc.frame;
      S.checkpoint();
      const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
      const p = M.FRAMES[preset];
      const area = f.w * f.h;
      const r = p.w / p.h;
      const w = Math.sqrt(area * r);
      S.doc.frame = Object.assign({}, f, { preset, w, h: w / r, x: cx - w / 2, y: cy - w / r / 2 });
      S.changed();
      E.fitFrame();
      UI.renderSettings();
    },

    async restoreVersion(vid) {
      const ok = await UI.confirm({ title: 'Restaurar esta versão?', message: 'O estado atual vira uma versão antes da troca, e você também pode desfazer.', ok: 'Restaurar' });
      if (!ok) return;
      const vdoc = await ST.getVersion(vid);
      if (!vdoc) { UI.toast('Versão não encontrada.', { type: 'error' }); return; }
      await saveNow();
      await ST.addVersion(S.doc, 'Antes de restaurar');
      await ensureImage(vdoc);
      S.checkpoint();
      const d = S.doc;
      const v = M.normalize(vdoc);
      ['name', 'frame', 'base', 'nodes', 'objects', 'settings'].forEach((k) => { d[k] = v[k]; });
      S.select(null);
      S.changed();
      E.fitFrame();
      UI.toast('Versão restaurada.', { type: 'ok' });
      UI.renderVersions();
    },

    async newProject() {
      await actions.saveNow();
      await loadDoc(M.newDoc());
    },

    async openProject(id) {
      if (id === S.doc.id) return;
      await actions.saveNow();
      const doc = await ST.getProject(id);
      if (!doc) { UI.toast('Mapa não encontrado.', { type: 'error' }); return; }
      await loadDoc(M.normalize(doc));
    },

    async deleteProject(id) {
      await ST.deleteProject(id);
      if (id === S.doc.id) {
        const list = await ST.listProjects();
        if (list.length) await loadDoc(M.normalize(await ST.getProject(list[0].id)));
        else await loadDoc(M.newDoc());
      }
      UI.toast('Mapa excluído.');
    },

    async duplicateProject(id) {
      await actions.saveNow();
      const doc = await ST.getProject(id);
      if (!doc) return;
      const copy = M.normalize(U.clone(doc));
      copy.id = U.uid('map');
      copy.name = (doc.name || 'Mapa') + ' (cópia)';
      copy.createdAt = copy.updatedAt = new Date().toISOString();
      await ensureImage(copy);
      await ST.putProject(copy, null);
      UI.toast('Cópia criada.', { type: 'ok' });
    },

    async exportProjectJson(id) {
      const doc = id === S.doc.id ? S.doc : await ST.getProject(id);
      if (!doc) return;
      await ensureImage(doc);
      await ST.exportJson(doc);
    },

    // Abre um cartão montado pelo mapa como um novo mapa (o atual fica salvo na galeria).
    async openGenerated(doc, canvas) {
      await actions.saveNow();
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const id = U.uid('img');
        await App.images.add(id, dataUrl);
        try { await ST.putImage(id, dataUrl); } catch (e) { console.warn(e); }
        doc.base.imageId = id;
      }
      await loadDoc(M.normalize(doc));
      await saveNow();
    },

    openTerritory: () => App.territory.open(),
    pickJson: () => $('jsonFile').click(),
    setBaseImage
  };
  App.actions = actions;

  /* ---------- Ligações da interface ---------- */

  function bindUi() {
    UI.hydrateIcons(document);
    UI.bindLayers();

    document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => E.setTool(b.dataset.tool)));
    $('undoBtn').onclick = () => S.undo();
    $('redoBtn').onclick = () => S.redo();
    $('zoomInBtn').onclick = () => E.zoomBy(1.25);
    $('zoomOutBtn').onclick = () => E.zoomBy(0.8);
    $('zoomValue').onclick = () => E.fitFrame();
    $('helpBtn').onclick = () => UI.openShortcuts();
    $('projectsBtn').onclick = () => UI.openProjects();

    const name = $('projectName');
    name.addEventListener('input', () => S.setDocField('name', name.value, 'name'));
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') name.blur(); });
    name.addEventListener('change', () => S.breakMerge());

    document.querySelectorAll('.tabs [role="tab"]').forEach((t) => t.addEventListener('click', () => UI.switchTab(t.dataset.tab)));
    $('panelToggle').onclick = () => $('panel').classList.toggle('collapsed');
    // No celular deitado falta altura: o painel começa recolhido.
    if (window.matchMedia('(max-width: 860px) and (max-height: 520px)').matches) $('panel').classList.add('collapsed');

    // Menu de exportação
    const menu = $('exportMenu');
    const btn = $('exportBtn');
    const closeMenu = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    menu.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => { closeMenu(); doExport(b.dataset.export); }));
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [probe] })) menu.querySelector('[data-export="share"]').hidden = false;
    } catch (e) { /* sem suporte */ }

    // Tela inicial
    document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.start;
      if (a === 'osm') App.osm.open();
      else if (a === 'territory') App.territory.open();
      else if (a === 'image') $('imageFile').click();
      else if (a === 'json') $('jsonFile').click();
      else if (a === 'blank') { S.doc._blank = true; updateStart(); E.setTool('road'); }
    }));

    $('imageFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) handleImageFile(f); });
    $('jsonFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importProjectFile(f); });

    // Colar print (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const item = Array.from(e.clipboardData ? e.clipboardData.items : []).find((i) => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      handleImageFile(item.getAsFile());
    });

    // Arrastar e soltar arquivos
    const stage = $('stage');
    const hint = $('dropHint');
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    stage.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; hint.hidden = false; });
    stage.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    stage.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) hint.hidden = true; });
    stage.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      hint.hidden = true;
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (/json$/i.test(f.name) || f.type === 'application/json') importProjectFile(f);
      else handleImageFile(f);
    });

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') actions.saveNow(); });
    window.addEventListener('beforeunload', () => { if (scheduleSave.pending()) actions.saveNow(); });
  }

  /* ---------- Início ---------- */

  async function boot() {
    bindUi();
    const prefs = ST.getPrefs();
    S.stylePrefs = prefs.styles || {};
    S.onPrefsChange = U.debounce(() => ST.setPrefs({ styles: S.stylePrefs }), 500);
    S.setDoc(M.newDoc());
    E.init();

    await ST.openDb();
    const imported = await ST.importLegacyLocalStorage();

    let doc = null;
    if (prefs.lastProjectId) doc = await ST.getProject(prefs.lastProjectId).catch(() => null);
    if (!doc) {
      const list = await ST.listProjects().catch(() => []);
      if (list.length) doc = await ST.getProject(list[0].id);
    }
    await loadDoc(doc ? M.normalize(doc) : M.newDoc());
    if (imported) UI.toast(imported + (imported === 1 ? ' mapa da versão anterior foi importado.' : ' mapas da versão anterior foram importados.') + ' Veja em Meus mapas.', { type: 'ok', duration: 6000 });
    ST.collectImages().catch(() => {});

    // Offline em produção (GitHub Pages); fora do ar em desenvolvimento local.
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
