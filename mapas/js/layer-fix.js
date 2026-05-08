(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const VERSION = 7;
  let lastKey = '';
  let lastTime = 0;

  function now() { return Date.now(); }

  function log(message, data) {
    if (window.console && console.info) console.info('[Territórios][camadas v' + VERSION + '] ' + message, data || '');
  }

  function warn(message, data) {
    if (window.console && console.warn) console.warn('[Territórios][camadas v' + VERSION + '] ' + message, data || '');
  }

  function stop(event) {
    if (!event) return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }

  function getElement(event) {
    const target = event && event.target;
    if (!target) return null;
    return target.nodeType === 1 ? target : target.parentElement;
  }

  function closestFromEvent(event, selector) {
    const el = getElement(event);
    return el && el.closest ? el.closest(selector) : null;
  }

  function isInsideLayerList(el) {
    const list = document.getElementById('objectList');
    return !!(list && el && list.contains(el));
  }

  function isDuplicate(action, objectId) {
    const key = action + ':' + (objectId || 'mapa');
    const t = now();
    if (lastKey === key && t - lastTime < 250) return true;
    lastKey = key;
    lastTime = t;
    return false;
  }

  function objectById(id) {
    if (!id || !T.store || !T.store.objectById) return null;
    return T.store.objectById(id);
  }

  function selectObject(id) {
    if (id && T.store && T.store.selectObject && objectById(id)) T.store.selectObject(id);
  }

  function refreshAfter(action, objectId) {
    selectObject(objectId);

    if (T.ui) {
      if (T.ui.refreshProperties) T.ui.refreshProperties();
      if (T.ui.refreshLayerList) T.ui.refreshLayerList();
      if (T.ui.updateDrawingButtons) T.ui.updateDrawingButtons();
      if (T.ui.updateUndoRedoButtons) T.ui.updateUndoRedoButtons();
      if (T.ui.updatePointButtons) T.ui.updatePointButtons();
      if (T.ui.updateFloatingHelp) T.ui.updateFloatingHelp();
    }

    if (T.drawing && T.drawing.draw) T.drawing.draw();
    if (T.storage && T.storage.autoSave) T.storage.autoSave();
    window.setTimeout(enhanceLayerList, 0);

    const obj = objectById(objectId);
    log('ação aplicada', {
      action: action,
      objectId: objectId || null,
      visible: obj ? obj.visible !== false : null,
      locked: obj ? !!obj.locked : null,
      selectedId: T.state ? T.state.selectedId : null
    });
  }

  function setMapVisible() {
    if (!T.state || !T.state.settings) return false;
    T.state.settings.mapVisible = !(T.state.settings.mapVisible !== false);
    if (T.ui && T.ui.refreshAll) T.ui.refreshAll();
    if (T.drawing && T.drawing.draw) T.drawing.draw();
    if (T.storage && T.storage.autoSave) T.storage.autoSave();
    window.setTimeout(enhanceLayerList, 0);
    log('mapa base: visibilidade alternada', { visible: T.state.settings.mapVisible !== false });
    return true;
  }

  function setMapLock() {
    if (!T.state || !T.state.settings) return false;
    T.state.settings.mapLocked = !T.state.settings.mapLocked;
    if (T.state.settings.mapLocked && T.state.tool === 'pan' && T.ui && T.ui.setTool) T.ui.setTool('select');
    if (T.ui && T.ui.refreshAll) T.ui.refreshAll();
    if (T.drawing && T.drawing.draw) T.drawing.draw();
    if (T.storage && T.storage.autoSave) T.storage.autoSave();
    window.setTimeout(enhanceLayerList, 0);
    log('mapa base: bloqueio alternado', { locked: !!T.state.settings.mapLocked });
    return true;
  }

  function runLayerAction(action, objectId, event, source) {
    stop(event);

    if (!action) {
      warn('ação vazia recebida', { source: source || 'desconhecido' });
      return false;
    }

    if (isDuplicate(action, objectId)) return false;

    log('ação recebida', { action: action, objectId: objectId || null, source: source || 'desconhecido' });

    if (action === 'object-visible') {
      const obj = objectById(objectId);
      if (!obj) {
        warn('objeto não encontrado para visibilidade', { objectId: objectId || null });
        return false;
      }
      if (T.store && T.store.toggleVisibility) T.store.toggleVisibility(objectId);
      else obj.visible = obj.visible === false ? true : false;
      refreshAfter(action, objectId);
      return false;
    }

    if (action === 'object-lock') {
      const obj = objectById(objectId);
      if (!obj) {
        warn('objeto não encontrado para bloqueio', { objectId: objectId || null });
        return false;
      }
      if (T.store && T.store.toggleLock) T.store.toggleLock(objectId);
      else obj.locked = !obj.locked;
      refreshAfter(action, objectId);
      return false;
    }

    if (action === 'map-visible') {
      setMapVisible();
      return false;
    }

    if (action === 'map-lock') {
      setMapLock();
      return false;
    }

    warn('ação desconhecida', { action: action, objectId: objectId || null });
    return false;
  }

  function selectLayerItem(item, event, source) {
    if (!item || !item.dataset || !item.dataset.objectId) return false;
    stop(event);
    const id = item.dataset.objectId;
    const obj = objectById(id);
    if (!obj) {
      warn('item da lista aponta para objeto inexistente', { objectId: id, source: source || 'lista' });
      return false;
    }

    selectObject(id);
    if (T.ui) {
      if (T.ui.refreshProperties) T.ui.refreshProperties();
      if (T.ui.refreshLayerList) T.ui.refreshLayerList();
      if (T.ui.updateDrawingButtons) T.ui.updateDrawingButtons();
      if (T.ui.updateUndoRedoButtons) T.ui.updateUndoRedoButtons();
      if (T.ui.updatePointButtons) T.ui.updatePointButtons();
      if (T.ui.updateFloatingHelp) T.ui.updateFloatingHelp();
    }
    if (T.drawing && T.drawing.draw) T.drawing.draw();
    window.setTimeout(enhanceLayerList, 0);

    log('camada selecionada pela lista', { objectId: id, visible: obj.visible !== false, locked: !!obj.locked });
    return false;
  }

  function handlePointerDown(event) {
    const button = closestFromEvent(event, '[data-layer-action]');
    if (!button || !isInsideLayerList(button)) return;
    runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'document-pointerdown');
  }

  function handleClick(event) {
    const button = closestFromEvent(event, '[data-layer-action]');
    if (button && isInsideLayerList(button)) {
      runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'document-click');
      return;
    }

    const item = closestFromEvent(event, '.layer-item[data-object-id]');
    if (item && isInsideLayerList(item)) selectLayerItem(item, event, 'document-click');
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const button = closestFromEvent(event, '[data-layer-action]');
    if (button && isInsideLayerList(button)) {
      runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'document-keydown');
      return;
    }

    const item = closestFromEvent(event, '.layer-item[data-object-id]');
    if (item && isInsideLayerList(item)) selectLayerItem(item, event, 'document-keydown');
  }

  function enhanceLayerList() {
    const list = document.getElementById('objectList');
    if (!list) return;

    list.querySelectorAll('[data-layer-action]').forEach(function (button) {
      button.type = 'button';
      button.style.pointerEvents = 'auto';
      button.style.position = 'relative';
      button.style.zIndex = '30';
      button.onclick = function (event) {
        return runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'button-onclick');
      };
      button.onmousedown = function (event) {
        return runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'button-onmousedown');
      };
      button.ontouchstart = function (event) {
        return runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'button-ontouchstart');
      };
    });

    list.querySelectorAll('.layer-item[data-object-id]').forEach(function (item) {
      item.style.pointerEvents = 'auto';
      item.style.position = 'relative';
      item.style.zIndex = '1';
      item.onclick = function (event) {
        if (closestFromEvent(event, '[data-layer-action]')) return false;
        return selectLayerItem(item, event, 'item-onclick');
      };
    });
  }

  function wrapRefreshLayerList() {
    if (!T.ui || !T.ui.refreshLayerList || T.ui.refreshLayerList.__layerFixWrapped) return false;
    const original = T.ui.refreshLayerList;
    T.ui.refreshLayerList = function () {
      const result = original.apply(T.ui, arguments);
      enhanceLayerList();
      return result;
    };
    T.ui.refreshLayerList.__layerFixWrapped = true;
    return true;
  }

  function layerFixStatus() {
    const list = document.getElementById('objectList');
    const buttons = list ? Array.from(list.querySelectorAll('[data-layer-action]')) : [];
    const items = list ? Array.from(list.querySelectorAll('.layer-item[data-object-id]')) : [];
    const status = {
      versao: VERSION,
      scriptCarregado: true,
      objectListExiste: !!list,
      botoes: buttons.map(function (button) {
        return {
          texto: button.textContent,
          action: button.dataset.layerAction || null,
          objectId: button.dataset.objectId || null,
          disabled: !!button.disabled
        };
      }),
      itens: items.map(function (item) {
        const obj = objectById(item.dataset.objectId);
        return {
          objectId: item.dataset.objectId,
          texto: item.innerText,
          existeNoEstado: !!obj,
          visible: obj ? obj.visible !== false : null,
          locked: obj ? !!obj.locked : null
        };
      }),
      objetos: T.state && T.state.objects ? T.state.objects.map(function (obj) {
        return { id: obj.id, type: obj.type, name: obj.name, visible: obj.visible !== false, locked: !!obj.locked };
      }) : []
    };
    console.log('[Territórios][camadas v' + VERSION + '] status:', status);
    if (console.table) console.table(status.objetos);
    return status;
  }

  function runLayerSelfTest() {
    if (!T.state || !T.state.objects || !T.state.objects.length) {
      warn('crie uma rua ou qualquer item antes de rodar o autoteste');
      return null;
    }
    const obj = T.state.objects[0];
    const id = obj.id;
    const original = { visible: obj.visible, locked: obj.locked, selectedId: T.state.selectedId };
    const steps = [];

    function snap(label) {
      const current = objectById(id);
      steps.push({
        passo: label,
        visible: current ? current.visible !== false : null,
        locked: current ? !!current.locked : null,
        selected: T.state.selectedId === id
      });
    }

    snap('início');
    runLayerAction('object-visible', id, null, 'self-test'); snap('após alternar visibilidade 1');
    runLayerAction('object-visible', id, null, 'self-test'); snap('após alternar visibilidade 2');
    runLayerAction('object-lock', id, null, 'self-test'); snap('após alternar bloqueio 1');
    runLayerAction('object-lock', id, null, 'self-test'); snap('após alternar bloqueio 2');

    const restored = objectById(id);
    if (restored) {
      restored.visible = original.visible;
      restored.locked = original.locked;
    }
    T.state.selectedId = original.selectedId;
    if (T.ui && T.ui.refreshAll) T.ui.refreshAll();
    snap('restaurado');

    console.log('[Territórios][camadas v' + VERSION + '] autoteste:', steps);
    if (console.table) console.table(steps);
    return steps;
  }

  T.layerButtonAction = function (button, event) {
    if (!button) return false;
    return runLayerAction(button.dataset.layerAction, button.dataset.objectId || null, event, 'global-inline');
  };
  T.layerFixStatus = layerFixStatus;
  T.runLayerSelfTest = runLayerSelfTest;
  T.__layerFixVersion = VERSION;

  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeydown, true);

  document.addEventListener('DOMContentLoaded', function () {
    wrapRefreshLayerList();
    enhanceLayerList();
    window.setTimeout(enhanceLayerList, 50);
    log('correção carregada. Use Territorios.layerFixStatus() para diagnosticar.');
  });

  // Como este script é carregado antes do DOMContentLoaded, a tentativa abaixo
  // normalmente só prepara o wrapper. Se o DOM já estiver pronto, também funciona.
  wrapRefreshLayerList();
  window.setTimeout(enhanceLayerList, 0);
})();
