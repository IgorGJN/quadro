(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    T.ui.setup();
    const canvas = document.getElementById('mapCanvas');
    const wrap = document.getElementById('canvasWrap');
    T.drawing.setup(canvas, wrap);
    if (canvas) bindCanvas(canvas);
    bindToolbar();
    bindProjectActions();
    T.ui.bindPropertyInputs();
    T.ui.bindSettingsInputs();
    window.addEventListener('resize', T.drawing.resizeCanvas);
    T.ui.setTool('select');
    T.ui.refreshAll();
    T.drawing.resizeCanvas();
  }

  function on(el, eventName, handler, options) {
    if (!el || !el.addEventListener) return;
    el.addEventListener(eventName, handler, options);
  }

  function bindToolbar() {
    document.querySelectorAll('[data-tool]').forEach(function (button) {
      on(button, 'click', function () {
        T.ui.setTool(button.dataset.tool);
      });
    });

    on(T.ui.els.finishRoadBtn, 'click', finishRoad);
    on(T.ui.els.finishAreaBtn, 'click', finishArea);
    on(T.ui.els.cancelDrawingBtn, 'click', cancelDrawing);

    on(T.ui.els.deleteBtn, 'click', function () { T.store.deleteSelected(); refreshAfterChange(); T.storage.autoSave(); });
    on(T.ui.els.duplicateBtn, 'click', function () { T.store.duplicateSelected(); refreshAfterChange(); T.storage.autoSave(); });
    on(T.ui.els.bringForwardBtn, 'click', function () { T.store.bringForward(); refreshAfterChange(); T.storage.autoSave(); });
    on(T.ui.els.sendBackwardBtn, 'click', function () { T.store.sendBackward(); refreshAfterChange(); T.storage.autoSave(); });

    on(T.ui.els.toggleVisibleBtn, 'click', function () {
      const obj = T.store.selectedObject();
      if (!obj) return;
      T.store.toggleVisibility(obj.id);
      refreshAfterChange();
      T.storage.autoSave();
    });

    on(T.ui.els.toggleLockBtn, 'click', function () {
      const obj = T.store.selectedObject();
      if (!obj) return;
      T.store.toggleLock(obj.id);
      refreshAfterChange();
      T.storage.autoSave();
    });

    on(T.ui.els.removePointBtn, 'click', function () {
      if (T.store.removeSelectedPoint()) { refreshAfterChange(); T.storage.autoSave(); }
    });

    on(T.ui.els.splitRoadBtn, 'click', function () {
      if (T.store.splitSelectedRoad()) { refreshAfterChange(); T.storage.autoSave(); }
    });

    on(T.ui.els.createIntersectionsBtn, 'click', function () {
      const count = T.drawing.createRealIntersections();
      refreshAfterChange();
      T.storage.autoSave();
      alert(count ? count + ' interseção(ões) real(is) criada(s).' : 'Nenhuma interseção nova encontrada.');
    });

    on(T.ui.els.centerFocusBtn, 'click', function () {
      const obj = T.store.selectedObject();
      if (!obj || obj.type !== 'focus') return;
      centerOnObject(obj);
    });

    on(T.ui.els.undoBtn, 'click', function () {
      if (T.store.undo()) reloadImageIfNeeded(false).then(refreshAfterChange);
    });
    on(T.ui.els.redoBtn, 'click', function () {
      if (T.store.redo()) reloadImageIfNeeded(false).then(refreshAfterChange);
    });
    on(T.ui.els.fitMapBtn, 'click', fitMap);
    on(T.ui.els.zoomInBtn, 'click', function () { zoomAtCenter(1.18); });
    on(T.ui.els.zoomOutBtn, 'click', function () { zoomAtCenter(0.84); });
    on(T.ui.els.toggleUiBtn, 'click', toggleCleanMode);

    bindMobileTabs();
  }

  function bindProjectActions() {
    const els = T.ui.els;

    els.imageInput.addEventListener('change', async function (event) {
      const file = event.target.files[0];
      if (!file) return;
      T.store.pushHistory();
      const dataUrl = await utils.readFileAsDataUrl(file);
      await loadImage(dataUrl, true);
      T.storage.autoSave();
      T.ui.updateFloatingHelp();
    });

    els.projectInput.addEventListener('change', async function (event) {
      const file = event.target.files[0];
      if (!file) return;
      const text = await utils.readFileAsText(file);
      const project = JSON.parse(text);
      T.store.loadProject(project);
      await reloadImageIfNeeded(true);
      T.ui.refreshAll();
      T.drawing.draw();
    });

    els.downloadJsonBtn.addEventListener('click', function () { T.storage.downloadProject(T.store.currentProject()); });

    els.saveLocalBtn.addEventListener('click', function () {
      try {
        const id = T.storage.saveProject(T.store.currentProject());
        T.storage.saveVersion(T.store.currentProject(), 'salvo manualmente');
        T.ui.refreshLocalProjects();
        T.ui.refreshVersions();
        els.localProjectsSelect.value = id;
        alert('Mapa salvo neste navegador.');
      } catch (error) {
        alert('Não foi possível salvar no navegador. A imagem pode estar muito grande. Use “Baixar JSON” como cópia segura.');
      }
    });

    els.openLocalBtn.addEventListener('click', async function () {
      const id = els.localProjectsSelect.value;
      if (!id) return;
      const project = T.storage.openProject(id);
      if (!project) return alert('Projeto local não encontrado.');
      T.store.loadProject(project);
      await reloadImageIfNeeded(true);
      T.ui.refreshAll();
      T.drawing.draw();
    });

    els.deleteLocalBtn.addEventListener('click', function () {
      const id = els.localProjectsSelect.value;
      if (!id) return;
      if (!confirm('Apagar este mapa salvo localmente, incluindo versões?')) return;
      T.storage.deleteProject(id);
      T.ui.refreshLocalProjects();
      T.ui.refreshVersions();
    });

    els.newProjectBtn.addEventListener('click', function () {
      if (!confirm('Criar um projeto vazio? O projeto atual só será mantido se você tiver salvo.')) return;
      T.store.pushHistory();
      T.store.loadProject({ projectName: '', imageData: null, objects: [], nodes: [] });
      T.state.image = null;
      T.ui.refreshAll();
      T.drawing.draw();
    });

    els.saveVersionBtn.addEventListener('click', function () {
      try {
        T.storage.saveVersion(T.store.currentProject(), 'manual');
        T.ui.refreshVersions();
        alert('Versão salva.');
      } catch (error) {
        alert('Não foi possível salvar a versão.');
      }
    });

    els.restoreVersionBtn.addEventListener('click', async function () {
      const id = T.storage.currentProjectId(T.store.currentProject());
      const versionId = els.versionSelect.value;
      if (!versionId) return;
      if (!confirm('Restaurar esta versão? O estado atual só será mantido se você salvar uma nova versão antes.')) return;
      const project = T.storage.restoreVersion(id, versionId);
      if (!project) return alert('Versão não encontrada.');
      T.store.pushHistory();
      T.store.loadProject(project);
      await reloadImageIfNeeded(true);
      T.ui.refreshAll();
      T.drawing.draw();
    });

    els.exportPngBtn.addEventListener('click', T.exporter.exportPng);
  }

  function bindCanvas(canvas) {
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('dblclick', onDoubleClick);

    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp, { passive: false });

    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();
      if (T.state.settings.mapLocked) return;
      const point = canvasPoint(event);
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      zoomAt(point.x, point.y, T.state.scale * factor);
    }, { passive: false });
  }

  function onPointerDown(event) {
    event.preventDefault();
    const state = T.state;

    if (event.touches && event.touches.length === 2) {
      if (!state.settings.mapLocked) startPinch(event);
      return;
    }

    const p = canvasPoint(event);
    const world = T.drawing.screenToWorld(p.x, p.y);

    if (state.tool === 'road') return addRoadPoint(world);
    if (state.tool === 'area') return addAreaPoint(world);
    if (state.tool === 'focus') return startFocus(world, p);
    if (state.tool === 'text') return addText(world);
    if (state.tool === 'point') return addPoint(world);
    if (state.tool === 'compass') return addCompass(world);
    if (state.tool === 'legend') return addLegend(world);
    if (state.tool === 'connect') return handleConnect(world);
    if (state.tool === 'edit') return handleEditDown(world, p);
    if (state.tool === 'pan') return startPan(p);

    handleSelectDown(world, p);
  }

  function onPointerMove(event) {
    event.preventDefault();
    const state = T.state;

    if (event.touches && event.touches.length === 2 && state.drag.mode === 'pinch') {
      movePinch(event);
      return;
    }

    const p = canvasPoint(event);
    const world = T.drawing.screenToWorld(p.x, p.y);

    if (state.tool === 'road' || state.tool === 'area') {
      T.drawing.snapPointPreview(world);
      T.drawing.draw();
      return;
    }

    if (!state.drag.active) return;

    const dx = p.x - state.drag.lastX;
    const dy = p.y - state.drag.lastY;

    if (state.drag.mode === 'focus-draw' && state.drawingFocus) {
      state.drawingFocus.w = world.x - state.drawingFocus.x;
      state.drawingFocus.h = world.y - state.drawingFocus.y;
    }

    if (state.drag.mode === 'pan') {
      state.offsetX += dx;
      state.offsetY += dy;
    }

    if (state.drag.mode === 'object') {
      const obj = T.store.selectedObject();
      T.store.moveObject(obj, dx / state.scale, dy / state.scale);
    }

    if (state.drag.mode === 'node' && state.drag.draggedNodeId) {
      T.store.setNodePosition(state.drag.draggedNodeId, world.x, world.y);
    }

    state.drag.lastX = p.x;
    state.drag.lastY = p.y;
    T.drawing.draw();
  }

  function onPointerUp(event) {
    if (event && event.preventDefault) event.preventDefault();
    const state = T.state;

    if (state.drag.mode === 'focus-draw' && state.drawingFocus) {
      const focus = state.drawingFocus;
      if (Math.abs(focus.w) > 8 && Math.abs(focus.h) > 8) {
        T.store.addObject(focus);
        T.ui.setTool('select');
        T.storage.autoSave();
      }
      state.drawingFocus = null;
    }

    state.drag.active = false;
    state.drag.mode = null;
    state.drag.draggedNodeId = null;
    state.drag.draggedPoint = null;
    T.ui.updateDrawingButtons();
    T.ui.refreshAll();
    T.drawing.draw();
  }

  function onDoubleClick(event) {
    event.preventDefault();
    if (T.state.tool === 'road') finishRoad();
    if (T.state.tool === 'area') finishArea();
  }

  function addRoadPoint(world) {
    const point = T.drawing.makeSnappedPoint(world);
    T.state.drawingRoad.push(point);
    T.ui.updateDrawingButtons();
    T.drawing.draw();
  }

  function addAreaPoint(world) {
    const point = T.drawing.makeSnappedPoint(world);
    T.state.drawingArea.push(point);
    T.ui.updateDrawingButtons();
    T.drawing.draw();
  }

  function finishRoad() {
    if (T.state.drawingRoad.length < 2) return;
    const points = T.state.drawingRoad.map(function (p) { return T.store.makePoint(p.x, p.y, p.nodeId || null); });
    T.store.addObject(Object.assign({ type: 'road', points: points, name: '' }, T.store.defaultStyle('road'), { points: points }));
    T.state.drawingRoad = [];
    T.state.snapPreview = null;
    afterNewObject();
  }

  function finishArea() {
    if (T.state.drawingArea.length < 3) return;
    const points = T.state.drawingArea.map(function (p) { return T.store.makePoint(p.x, p.y, p.nodeId || null); });
    T.store.addObject(Object.assign({ type: 'area', points: points, name: 'Área' }, T.store.defaultStyle('area'), { points: points }));
    T.state.drawingArea = [];
    T.state.snapPreview = null;
    afterNewObject();
  }

  function cancelDrawing() {
    T.state.drawingRoad = [];
    T.state.drawingArea = [];
    T.state.drawingFocus = null;
    T.state.snapPreview = null;
    T.state.connectDraft = null;
    T.ui.updateDrawingButtons();
    T.drawing.draw();
  }

  function startFocus(world, screenPoint) {
    T.store.pushHistory();
    T.state.drawingFocus = Object.assign({ type: 'focus', x: world.x, y: world.y, w: 0, h: 0, name: 'Área de foco' }, T.store.defaultStyle('focus'));
    T.state.drag.active = true;
    T.state.drag.mode = 'focus-draw';
    T.state.drag.lastX = screenPoint.x;
    T.state.drag.lastY = screenPoint.y;
    T.ui.updateDrawingButtons();
    T.drawing.draw();
  }

  function addText(world) {
    T.store.addObject(Object.assign({ type: 'text', x: world.x, y: world.y, name: 'Nome ou número' }, T.store.defaultStyle('text')));
    afterNewObject();
  }

  function addPoint(world) {
    T.store.addObject(Object.assign({ type: 'point', x: world.x, y: world.y, name: 'Referência' }, T.store.defaultStyle('point')));
    afterNewObject();
  }

  function addCompass(world) {
    T.store.addObject(Object.assign({ type: 'compass', x: world.x, y: world.y, name: '' }, T.store.defaultStyle('compass')));
    afterNewObject();
  }

  function addLegend(world) {
    T.store.addObject(Object.assign({ type: 'legend', x: world.x, y: world.y }, T.store.defaultStyle('legend')));
    afterNewObject();
  }

  function handleConnect(world) {
    const hit = T.drawing.hitObjectPoint(world.x, world.y);
    if (!hit || !hit.nodeId) {
      T.ui.updateFloatingHelp();
      return;
    }

    if (!T.state.connectDraft) {
      T.state.connectDraft = { nodeId: hit.nodeId };
      T.store.selectPoint(hit.object.id, hit.index);
      T.ui.refreshAll();
      T.drawing.draw();
      return;
    }

    if (T.state.connectDraft.nodeId === hit.nodeId) return;

    T.store.pushHistory();
    T.store.mergeNodes(hit.nodeId, T.state.connectDraft.nodeId);
    T.state.connectDraft = null;
    T.store.selectPoint(hit.object.id, hit.index);
    refreshAfterChange();
    T.storage.autoSave();
  }

  function handleEditDown(world, screenPoint) {
    const selected = T.store.selectedObject();
    const pointHit = T.drawing.hitObjectPoint(world.x, world.y, selected ? selected.id : null) || T.drawing.hitObjectPoint(world.x, world.y);
    if (pointHit && pointHit.nodeId) {
      T.store.selectPoint(pointHit.object.id, pointHit.index);
      T.store.pushHistory();
      T.state.drag.active = true;
      T.state.drag.mode = 'node';
      T.state.drag.draggedNodeId = pointHit.nodeId;
      T.state.drag.lastX = screenPoint.x;
      T.state.drag.lastY = screenPoint.y;
      T.ui.refreshAll();
      T.drawing.draw();
      return;
    }

    if (selected && selected.points && !selected.locked) {
      const segment = T.drawing.hitSegment(world.x, world.y, { distance: 18 });
      if (segment && segment.object.id === selected.id) {
        T.store.pushHistory();
        const point = T.store.insertNodeIntoObject(selected.id, segment.segmentIndex, segment.x, segment.y);
        T.store.selectPoint(selected.id, segment.segmentIndex + 1);
        T.ui.refreshAll();
        T.drawing.draw();
        T.storage.autoSave();
        return;
      }
    }

    handleSelectDown(world, screenPoint);
  }


  function startPan(screenPoint) {
    if (T.state.settings.mapLocked) return;
    T.store.selectObject(null);
    T.state.drag.active = true;
    T.state.drag.mode = 'pan';
    T.state.drag.lastX = screenPoint.x;
    T.state.drag.lastY = screenPoint.y;
    T.ui.refreshAll();
    T.drawing.draw();
  }

  function handleSelectDown(world, screenPoint) {
    const pointHit = T.drawing.hitObjectPoint(world.x, world.y, T.state.selectedId);
    if (pointHit && pointHit.nodeId) {
      T.store.selectPoint(pointHit.object.id, pointHit.index);
      T.store.pushHistory();
      T.state.drag.active = true;
      T.state.drag.mode = 'node';
      T.state.drag.draggedNodeId = pointHit.nodeId;
      T.state.drag.lastX = screenPoint.x;
      T.state.drag.lastY = screenPoint.y;
      T.ui.refreshAll();
      T.drawing.draw();
      return;
    }

    const hit = T.drawing.hitTest(world.x, world.y);
    if (hit) {
      T.store.selectObject(hit.id);
      if (!hit.locked) {
        T.store.pushHistory();
        T.state.drag.active = true;
        T.state.drag.mode = 'object';
      } else {
        T.state.drag.active = false;
        T.state.drag.mode = null;
      }
    } else {
      T.store.selectObject(null);
      if (!T.state.settings.mapLocked) {
        T.state.drag.active = true;
        T.state.drag.mode = 'pan';
      } else {
        T.state.drag.active = false;
        T.state.drag.mode = null;
      }
    }
    T.state.drag.lastX = screenPoint.x;
    T.state.drag.lastY = screenPoint.y;
    T.ui.refreshAll();
    T.drawing.draw();
  }

  function afterNewObject() {
    T.ui.setTool('select');
    refreshAfterChange();
    T.storage.autoSave();
  }

  function refreshAfterChange() {
    T.ui.refreshAll();
    T.drawing.draw();
  }

  function centerOnObject(obj) {
    const box = T.drawing.getObjectBox(obj);
    const wrap = document.getElementById('canvasWrap');
    const rect = wrap.getBoundingClientRect();
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    T.state.offsetX = rect.width / 2 - cx * T.state.scale;
    T.state.offsetY = rect.height / 2 - cy * T.state.scale;
    T.drawing.draw();
  }


  function fitMap() {
    if (T.state.settings.mapLocked) return;
    T.drawing.fitImage();
    T.drawing.draw();
  }

  function zoomAtCenter(factor) {
    const wrap = document.getElementById('canvasWrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, T.state.scale * factor);
  }

  function toggleCleanMode() {
    document.body.classList.toggle('presentation-mode');
    if (T.ui.els.toggleUiBtn) {
      T.ui.els.toggleUiBtn.textContent = document.body.classList.contains('presentation-mode') ? 'Mostrar painéis' : 'Modo limpo';
    }
    setTimeout(function () {
      T.drawing.resizeCanvas();
      T.drawing.draw();
    }, 0);
  }

  function bindMobileTabs() {
    document.querySelectorAll('[data-mobile-panel]').forEach(function (button) {
      on(button, 'click', function () {
        const panel = button.dataset.mobilePanel || 'create';
        document.body.classList.remove('mobile-create', 'mobile-edit', 'mobile-layers', 'mobile-project');
        document.body.classList.add('mobile-' + panel);
        document.querySelectorAll('[data-mobile-panel]').forEach(function (item) {
          item.classList.toggle('active', item === button);
        });
        setTimeout(T.drawing.resizeCanvas, 0);
      });
    });
  }

  function canvasPoint(event) {
    const canvas = document.getElementById('mapCanvas');
    const rect = canvas.getBoundingClientRect();
    const source = event.touches && event.touches.length ? event.touches[0] : event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  function zoomAt(sx, sy, newScale) {
    const state = T.state;
    if (state.settings.mapLocked) return;
    newScale = utils.clamp(newScale, 0.1, 10);
    const before = T.drawing.screenToWorld(sx, sy);
    state.scale = newScale;
    const after = T.drawing.worldToScreen(before.x, before.y);
    state.offsetX += sx - after.x;
    state.offsetY += sy - after.y;
    T.drawing.draw();
  }

  function startPinch(event) {
    const state = T.state;
    if (state.settings.mapLocked) return;
    state.drag.mode = 'pinch';
    state.drag.pinchStartDistance = touchDistance(event.touches[0], event.touches[1]);
    state.drag.pinchStartScale = state.scale;
    state.drag.pinchStartCenter = touchCenter(event.touches[0], event.touches[1]);
  }

  function movePinch(event) {
    const state = T.state;
    if (state.settings.mapLocked) return;
    const canvas = document.getElementById('mapCanvas');
    const rect = canvas.getBoundingClientRect();
    const dist = touchDistance(event.touches[0], event.touches[1]);
    const center = touchCenter(event.touches[0], event.touches[1]);
    const sx = center.x - rect.left;
    const sy = center.y - rect.top;
    const newScale = state.drag.pinchStartScale * dist / Math.max(1, state.drag.pinchStartDistance);
    zoomAt(sx, sy, newScale);
    if (state.drag.pinchStartCenter) {
      const dx = center.x - state.drag.pinchStartCenter.x;
      const dy = center.y - state.drag.pinchStartCenter.y;
      state.offsetX += dx * 0.4;
      state.offsetY += dy * 0.4;
      T.drawing.draw();
    }
  }

  function touchDistance(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  function touchCenter(a, b) { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }

  function loadImage(dataUrl, resetView) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        T.state.image = img;
        T.state.imageData = dataUrl;
        if (resetView) T.drawing.fitImage();
        T.drawing.draw();
        resolve();
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function reloadImageIfNeeded(resetView) {
    if (!T.state.imageData) {
      T.state.image = null;
      return Promise.resolve();
    }
    return loadImage(T.state.imageData, resetView);
  }
})();
