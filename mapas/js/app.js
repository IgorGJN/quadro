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
    bindCanvas(canvas);
    bindToolbar();
    bindProjectActions();
    T.ui.bindPropertyInputs();
    T.ui.bindSettingsInputs();

    window.addEventListener('resize', T.drawing.resizeCanvas);

    T.ui.setTool('select');
    T.ui.refreshAll();
    T.drawing.resizeCanvas();
  }

  function bindToolbar() {
    document.querySelectorAll('[data-tool]').forEach(function (button) {
      button.addEventListener('click', function () {
        T.ui.setTool(button.dataset.tool);
        T.ui.updateFloatingHelp();
      });
    });

    T.ui.els.finishRoadBtn.addEventListener('click', finishRoad);
    T.ui.els.finishAreaBtn.addEventListener('click', finishArea);
    T.ui.els.cancelDrawingBtn.addEventListener('click', cancelDrawing);

    T.ui.els.deleteBtn.addEventListener('click', function () {
      T.store.deleteSelected();
      refreshAfterChange();
    });

    T.ui.els.duplicateBtn.addEventListener('click', function () {
      T.store.duplicateSelected();
      refreshAfterChange();
    });

    T.ui.els.bringForwardBtn.addEventListener('click', function () {
      T.store.bringForward();
      refreshAfterChange();
    });

    T.ui.els.sendBackwardBtn.addEventListener('click', function () {
      T.store.sendBackward();
      refreshAfterChange();
    });

    T.ui.els.undoBtn.addEventListener('click', function () {
      if (T.store.undo()) {
        reloadImageIfNeeded().then(refreshAfterChange);
      }
    });

    T.ui.els.redoBtn.addEventListener('click', function () {
      if (T.store.redo()) {
        reloadImageIfNeeded().then(refreshAfterChange);
      }
    });

    T.ui.els.fitMapBtn.addEventListener('click', function () {
      T.drawing.fitImage();
      T.drawing.draw();
    });
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

    els.downloadJsonBtn.addEventListener('click', function () {
      T.storage.downloadProject(T.store.currentProject());
    });

    els.saveLocalBtn.addEventListener('click', function () {
      try {
        const id = T.storage.saveProject(T.store.currentProject());
        T.ui.refreshLocalProjects();
        T.ui.els.localProjectsSelect.value = id;
        alert('Mapa salvo neste navegador.');
      } catch (error) {
        alert('Não foi possível salvar no navegador. A imagem pode estar muito grande. Use “Baixar JSON” como cópia segura.');
      }
    });

    els.openLocalBtn.addEventListener('click', async function () {
      const id = els.localProjectsSelect.value;
      if (!id) return;

      const project = T.storage.openProject(id);
      if (!project) {
        alert('Projeto local não encontrado.');
        return;
      }

      T.store.loadProject(project);
      await reloadImageIfNeeded(true);
      T.ui.refreshAll();
      T.drawing.draw();
    });

    els.deleteLocalBtn.addEventListener('click', function () {
      const id = els.localProjectsSelect.value;
      if (!id) return;
      if (!confirm('Apagar este mapa salvo localmente?')) return;

      T.storage.deleteProject(id);
      T.ui.refreshLocalProjects();
    });

    els.newProjectBtn.addEventListener('click', function () {
      if (!confirm('Criar um projeto vazio? O projeto atual só será mantido se você tiver salvo.')) return;

      T.store.pushHistory();
      T.store.loadProject({ projectName: '', imageData: null, objects: [] });
      T.state.image = null;
      T.ui.refreshAll();
      T.drawing.draw();
    });

    els.exportPngBtn.addEventListener('click', T.exporter.exportPng);
  }

  function bindCanvas(canvas) {
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove', onPointerMove, { passive: false });
    canvas.addEventListener('touchend', onPointerUp, { passive: false });

    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();

      const point = canvasPoint(event);
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      zoomAt(point.x, point.y, T.state.scale * factor);
    }, { passive: false });
  }

  function onPointerDown(event) {
    event.preventDefault();

    const state = T.state;

    if (event.touches && event.touches.length === 2) {
      startPinch(event);
      return;
    }

    const p = canvasPoint(event);
    let world = T.drawing.screenToWorld(p.x, p.y);

    if (state.tool === 'road') {
      world = T.drawing.snapPoint(world);
      state.drawingRoad.push(world);
      T.ui.updateDrawingButtons();
      T.drawing.draw();
      return;
    }

    if (state.tool === 'area') {
      world = T.drawing.snapPoint(world);
      state.drawingArea.push(world);
      T.ui.updateDrawingButtons();
      T.drawing.draw();
      return;
    }

    if (state.tool === 'focus') {
      T.store.pushHistory();
      state.drawingFocus = {
        type: 'focus',
        x: world.x,
        y: world.y,
        w: 0,
        h: 0,
        name: 'Área de foco',
        color: '#ffffff',
        borderColor: '#111827',
        borderWidth: 4,
        size: 16,
        opacity: 0.55,
        rotation: 0
      };
      state.drag.active = true;
      state.drag.mode = 'focus-draw';
      state.drag.lastX = p.x;
      state.drag.lastY = p.y;
      T.ui.updateDrawingButtons();
      T.drawing.draw();
      return;
    }

    if (state.tool === 'text') {
      T.store.addObject({
        type: 'text',
        x: world.x,
        y: world.y,
        name: 'Nome ou número',
        color: '#111827',
        borderColor: '#ffffff',
        borderWidth: 4,
        size: 18,
        rotation: 0
      });
      afterNewObject();
      return;
    }

    if (state.tool === 'point') {
      T.store.addObject({
        type: 'point',
        x: world.x,
        y: world.y,
        name: 'Referência',
        icon: '●',
        color: '#dc2626',
        borderColor: '#ffffff',
        borderWidth: 0,
        size: 24,
        rotation: 0
      });
      afterNewObject();
      return;
    }

    if (state.tool === 'compass') {
      T.store.addObject({
        type: 'compass',
        x: world.x,
        y: world.y,
        name: '',
        color: '#111827',
        borderColor: '#ffffff',
        borderWidth: 3,
        size: 60,
        rotation: 0
      });
      afterNewObject();
      return;
    }

    if (state.tool === 'legend') {
      T.store.addObject({
        type: 'legend',
        x: world.x,
        y: world.y,
        name: 'Legenda\n● Ponto de referência\n— Rua\n▣ Área de foco',
        color: '#111827',
        backgroundColor: '#ffffff',
        borderColor: '#111827',
        borderWidth: 2,
        size: 16,
        opacity: 0.12
      });
      afterNewObject();
      return;
    }

    const hit = T.drawing.hitTest(world.x, world.y);
    if (hit) {
      T.store.selectObject(hit.id);
      T.store.pushHistory();
      state.drag.active = true;
      state.drag.mode = 'object';
    } else {
      T.store.selectObject(null);
      state.drag.active = true;
      state.drag.mode = 'pan';
    }

    state.drag.lastX = p.x;
    state.drag.lastY = p.y;

    T.ui.refreshProperties();
    T.ui.refreshLayerList();
    T.drawing.draw();
  }

  function onPointerMove(event) {
    event.preventDefault();

    const state = T.state;

    if (event.touches && event.touches.length === 2 && state.drag.mode === 'pinch') {
      movePinch(event);
      return;
    }

    const p = canvasPoint(event);

    if (state.tool === 'road' || state.tool === 'area') {
      const world = T.drawing.screenToWorld(p.x, p.y);
      T.drawing.snapPoint(world);
      T.drawing.draw();
      return;
    }

    if (!state.drag.active) return;

    const dx = p.x - state.drag.lastX;
    const dy = p.y - state.drag.lastY;

    if (state.drag.mode === 'focus-draw' && state.drawingFocus) {
      const world = T.drawing.screenToWorld(p.x, p.y);
      state.drawingFocus.w = world.x - state.drawingFocus.x;
      state.drawingFocus.h = world.y - state.drawingFocus.y;
    }

    if (state.drag.mode === 'pan') {
      state.offsetX += dx;
      state.offsetY += dy;
    }

    if (state.drag.mode === 'object') {
      const obj = T.store.selectedObject();
      T.drawing.moveObject(obj, dx / state.scale, dy / state.scale);
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
        const item = Object.assign({ id: utils.uid() }, focus);
        state.objects.push(item);
        state.selectedId = item.id;
        T.ui.setTool('select');
        T.storage.autoSave();
      }
      state.drawingFocus = null;
    }

    state.drag.active = false;
    state.drag.mode = null;

    T.ui.updateDrawingButtons();
    T.ui.refreshAll();
    T.drawing.draw();
  }

  function finishRoad() {
    if (T.state.drawingRoad.length < 2) return;

    T.store.addObject({
      type: 'road',
      points: T.state.drawingRoad.slice(),
      name: '',
      color: '#2563eb',
      borderColor: '#ffffff',
      borderWidth: 0,
      size: 8,
      rounded: true,
      smooth: false
    });

    T.state.drawingRoad = [];
    T.state.snapPreview = null;
    afterNewObject();
  }

  function finishArea() {
    if (T.state.drawingArea.length < 3) return;

    T.store.addObject({
      type: 'area',
      points: T.state.drawingArea.slice(),
      name: 'Área',
      color: '#facc15',
      borderColor: '#111827',
      borderWidth: 3,
      size: 16,
      opacity: 0.25,
      rounded: true,
      smooth: false
    });

    T.state.drawingArea = [];
    T.state.snapPreview = null;
    afterNewObject();
  }

  function cancelDrawing() {
    T.state.drawingRoad = [];
    T.state.drawingArea = [];
    T.state.drawingFocus = null;
    T.state.snapPreview = null;
    T.ui.updateDrawingButtons();
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

  function canvasPoint(event) {
    const canvas = document.getElementById('mapCanvas');
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;

    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  }

  function zoomAt(sx, sy, newScale) {
    const state = T.state;
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
    const center = touchCenter(event.touches[0], event.touches[1]);

    state.drag.mode = 'pinch';
    state.drag.pinchStartDistance = touchDistance(event.touches[0], event.touches[1]);
    state.drag.pinchStartScale = state.scale;
    state.drag.pinchStartOffsetX = state.offsetX;
    state.drag.pinchStartOffsetY = state.offsetY;
    state.drag.pinchStartCenter = center;
  }

  function movePinch(event) {
    const state = T.state;
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

  function touchDistance(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function touchCenter(a, b) {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2
    };
  }

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
