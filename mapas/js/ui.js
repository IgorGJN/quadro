(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;
  const els = {};

  const typeLabels = { road: 'Rua', text: 'Nome/Número', point: 'Ponto', area: 'Área', focus: 'Foco', compass: 'Bússola', legend: 'Legenda' };
  const typeOrder = ['road', 'text', 'point', 'area', 'focus', 'compass', 'legend'];

  const toolHints = {
    select: 'Selecionar: toque em um item para selecionar. Arraste área vazia para mover o mapa. Arraste item desbloqueado para mover.',
    pan: 'Mão / navegar: arraste para mover o mapa. Use a roda do mouse, os botões de zoom ou dois dedos no celular.',
    edit: 'Editar nós: selecione uma rua/área. Toque em um nó para mover; toque em um segmento para inserir novo ponto.',
    connect: 'Conectar: toque no primeiro nó e depois no segundo. O nó verde indica junção real compartilhada.',
    road: 'Rua: toque ponto por ponto. Perto de nó/segmento, o ponto encaixa. Use “Concluir rua”.',
    text: 'Nome/Nº: toque no mapa para inserir texto ou número. Depois ajuste rotação, tamanho e borda.',
    point: 'Ponto: toque para inserir referência.',
    area: 'Área: toque ponto por ponto para criar território/área, inclusive côncava. Use “Concluir área”.',
    focus: 'Foco: toque e arraste. O interior fica limpo e a máscara aparece fora.',
    compass: 'Norte: toque para inserir bússola. Ajuste tamanho e rotação.',
    legend: 'Legenda: toque para inserir. Edite o texto no painel, uma linha por item.'
  };

  const fieldsByType = {
    road: ['color', 'border-color', 'size', 'border-width', 'rounded', 'smooth', 'visible', 'locked'],
    text: ['name', 'color', 'border-color', 'size', 'border-width', 'rotation', 'visible', 'locked'],
    point: ['name', 'color', 'border-color', 'size', 'border-width', 'rotation', 'icon', 'visible', 'locked'],
    area: ['name', 'color', 'border-color', 'size', 'border-width', 'opacity', 'smooth', 'visible', 'locked'],
    focus: ['name', 'color', 'border-color', 'size', 'border-width', 'opacity', 'rotation', 'shape', 'visible', 'locked'],
    compass: ['color', 'size', 'border-width', 'rotation', 'visible', 'locked'],
    legend: ['name', 'color', 'background', 'border-color', 'size', 'border-width', 'opacity', 'visible', 'locked']
  };

  const lockProtectedInputs = [
    'nameInput', 'colorInput', 'backgroundColorInput', 'borderColorInput', 'sizeInput',
    'borderWidthInput', 'opacityInput', 'rotationInput', 'shapeInput', 'iconInput',
    'roundedInput', 'smoothInput'
  ];

  const lockProtectedButtons = [
    'bringForwardBtn', 'sendBackwardBtn', 'deleteBtn', 'removePointBtn', 'splitRoadBtn', 'centerFocusBtn'
  ];

  function setup() {
    [
      'imageInput', 'projectInput', 'downloadJsonBtn', 'saveLocalBtn', 'openLocalBtn',
      'deleteLocalBtn', 'newProjectBtn', 'exportPngBtn', 'finishRoadBtn', 'finishAreaBtn',
      'cancelDrawingBtn', 'projectNameInput', 'localProjectsSelect', 'autoSaveInput',
      'versionSelect', 'saveVersionBtn', 'restoreVersionBtn', 'nameInput', 'colorInput',
      'backgroundColorInput', 'borderColorInput', 'sizeInput', 'borderWidthInput',
      'opacityInput', 'rotationInput', 'shapeInput', 'iconInput', 'roundedInput',
      'smoothInput', 'visibleInput', 'lockedInput', 'duplicateBtn', 'bringForwardBtn',
      'sendBackwardBtn', 'centerFocusBtn', 'deleteBtn', 'removePointBtn', 'splitRoadBtn',
      'createIntersectionsBtn', 'showNodesInput', 'nodeLabelsInput', 'snapEnabledInput',
      'snapDistanceInput', 'undoBtn', 'redoBtn', 'fitMapBtn', 'objectList', 'propertiesPanel',
      'emptySelectionMessage', 'toolHint', 'floatingHelp', 'nodeHint', 'selectionStatus',
      'zoomInBtn', 'zoomOutBtn', 'toggleUiBtn', 'mobileTabs', 'mapVisibleInput',
      'mapLockedInput', 'toggleVisibleBtn', 'toggleLockBtn'
    ].forEach(function (id) { els[id] = document.getElementById(id); });
    enhanceNumberControls();
  }

  function hasEl(name) { return !!els[name]; }

  const numberControlSteps = {
    sizeInput: 1,
    borderWidthInput: 1,
    rotationInput: 1,
    snapDistanceInput: 1
  };

  function enhanceNumberControls() {
    Object.keys(numberControlSteps).forEach(function (id) {
      const input = els[id];
      if (!input || input.closest('.number-control')) return;
      input.setAttribute('step', String(numberControlSteps[id]));
      input.setAttribute('inputmode', 'numeric');

      const wrapper = document.createElement('div');
      wrapper.className = 'number-control';
      const minus = document.createElement('button');
      const plus = document.createElement('button');
      minus.type = 'button';
      plus.type = 'button';
      minus.className = 'number-step';
      plus.className = 'number-step';
      minus.textContent = '−';
      plus.textContent = '+';
      minus.setAttribute('aria-label', 'Diminuir');
      plus.setAttribute('aria-label', 'Aumentar');

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(minus);
      wrapper.appendChild(input);
      wrapper.appendChild(plus);

      function step(direction) {
        if (input.disabled) return;
        const stepValue = Number(input.step || numberControlSteps[id] || 1);
        const min = input.min === '' ? -Infinity : Number(input.min);
        const max = input.max === '' ? Infinity : Number(input.max);
        const current = input.value === '' ? 0 : Number(input.value);
        const next = Math.max(min, Math.min(max, current + direction * stepValue));
        const decimals = String(stepValue).includes('.') ? String(stepValue).split('.')[1].length : 0;
        input.value = decimals ? next.toFixed(decimals) : String(Math.round(next));
        if (T.store && T.store.selectedObject && T.store.selectedObject()) T.store.pushHistory();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      minus.addEventListener('click', function () { step(-1); });
      plus.addEventListener('click', function () { step(1); });
      input.addEventListener('wheel', function (event) {
        event.preventDefault();
        input.blur();
      }, { passive: false });
    });
  }

  function setTool(tool) {
    T.state.tool = tool;
    if (tool !== 'connect') T.state.connectDraft = null;
    document.querySelectorAll('[data-tool]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.tool === tool);
    });
    if (els.toolHint) els.toolHint.textContent = toolHints[tool] || '';
    updateFloatingHelp();
    T.drawing.draw();
  }

  function refreshAll() {
    if (els.projectNameInput) els.projectNameInput.value = T.state.projectName || '';
    if (els.snapEnabledInput) els.snapEnabledInput.checked = !!T.state.settings.snapEnabled;
    if (els.snapDistanceInput) els.snapDistanceInput.value = T.state.settings.snapDistance || 22;
    if (els.autoSaveInput) els.autoSaveInput.checked = !!T.state.settings.autoSave;
    if (els.showNodesInput) els.showNodesInput.checked = !!T.state.settings.showNodes;
    if (els.nodeLabelsInput) els.nodeLabelsInput.checked = !!T.state.settings.nodeLabels;
    if (els.mapVisibleInput) els.mapVisibleInput.checked = T.state.settings.mapVisible !== false;
    if (els.mapLockedInput) els.mapLockedInput.checked = !!T.state.settings.mapLocked;
    updateMapButtons();
    refreshProperties();
    refreshLayerList();
    refreshLocalProjects();
    refreshVersions();
    updateDrawingButtons();
    updateUndoRedoButtons();
    updatePointButtons();
    updateFloatingHelp();
  }

  function refreshProperties() {
    const obj = T.store.selectedObject();
    if (els.propertiesPanel) els.propertiesPanel.classList.toggle('hidden', !obj);
    if (els.emptySelectionMessage) els.emptySelectionMessage.classList.toggle('hidden', !!obj);
    if (!obj) {
      updateSelectionStatus(null);
      updateLockedFields(null);
      return;
    }

    els.nameInput.value = obj.name || '';
    els.colorInput.value = obj.color || '#2563eb';
    els.backgroundColorInput.value = obj.backgroundColor || '#ffffff';
    els.borderColorInput.value = obj.borderColor || '#ffffff';
    els.sizeInput.value = obj.size || 16;
    els.borderWidthInput.value = obj.borderWidth || 0;
    els.opacityInput.value = obj.opacity ?? 0.45;
    els.rotationInput.value = obj.rotation || 0;
    els.shapeInput.value = obj.shape === 'circle' ? 'ellipse' : obj.shape || 'rect';
    els.iconInput.value = obj.icon || '●';
    els.roundedInput.checked = obj.rounded !== false;
    els.smoothInput.checked = !!obj.smooth;
    els.visibleInput.checked = obj.visible !== false;
    els.lockedInput.checked = !!obj.locked;

    configureLabels(obj.type);
    showRelevantFields(obj.type);
    updateSelectionStatus(obj);
    updateLockedFields(obj);
    updatePointButtons();
  }

  function configureLabels(type) {
    document.getElementById('nameLabel').textContent = type === 'legend' ? 'Texto da legenda' : type === 'road' ? 'Nome interno' : 'Texto/nome';
    document.getElementById('colorLabel').textContent = type === 'focus' ? 'Cor da máscara externa' : type === 'legend' ? 'Cor do texto' : 'Cor principal';
    document.getElementById('backgroundColorLabel').textContent = 'Cor de fundo';
    document.getElementById('borderColorLabel').textContent = type === 'focus' ? 'Cor do contorno do foco' : 'Cor da borda';
    document.getElementById('sizeLabel').textContent = type === 'road' ? 'Largura da rua' : type === 'area' ? 'Tamanho do texto da área' : 'Tamanho';
    document.getElementById('borderWidthLabel').textContent = type === 'road' ? 'Espessura da borda da rua' : 'Espessura da borda';
    document.getElementById('opacityLabel').textContent = type === 'focus' ? 'Opacidade da máscara externa' : type === 'area' ? 'Opacidade do preenchimento' : 'Transparência do fundo';
  }

  function showRelevantFields(type) {
    const visible = new Set(fieldsByType[type] || []);
    ['name', 'color', 'background', 'border-color', 'size', 'border-width', 'opacity', 'rotation', 'shape', 'icon', 'rounded', 'smooth', 'visible', 'locked'].forEach(function (name) {
      document.querySelectorAll('.field-' + name).forEach(function (el) { el.classList.toggle('hidden', !visible.has(name)); });
    });
    if (els.centerFocusBtn) els.centerFocusBtn.classList.toggle('hidden', type !== 'focus');
  }

  function updateSelectionStatus(obj) {
    if (!els.selectionStatus) return;
    if (!obj) {
      els.selectionStatus.className = 'selection-status';
      els.selectionStatus.textContent = '';
      return;
    }

    const messages = [];
    let tone = 'info';
    if (obj.visible === false) {
      messages.push('Camada oculta: ela não aparece no mapa nem será exportada, mas pode ser reativada aqui ou na lista de camadas.');
      tone = 'warn';
    }
    if (obj.locked) {
      messages.push('Camada bloqueada: não pode ser movida nem editada até ser desbloqueada.');
      tone = obj.visible === false ? 'warn' : 'info';
    }

    if (!messages.length) {
      els.selectionStatus.className = 'selection-status';
      els.selectionStatus.textContent = '';
      return;
    }

    els.selectionStatus.className = 'selection-status visible ' + tone;
    els.selectionStatus.textContent = messages.join(' ');
  }

  function updateLockedFields(obj) {
    const locked = !!(obj && obj.locked);
    const disabled = !obj || locked;
    lockProtectedInputs.forEach(function (id) {
      if (els[id]) els[id].disabled = disabled;
    });

    lockProtectedButtons.forEach(function (id) {
      if (!els[id]) return;
      if (id === 'centerFocusBtn' && obj && obj.type !== 'focus') return;
      els[id].disabled = disabled;
    });

    if (els.duplicateBtn) els.duplicateBtn.disabled = !obj;
    if (els.visibleInput) els.visibleInput.disabled = !obj;
    if (els.lockedInput) els.lockedInput.disabled = !obj;
    if (els.toggleVisibleBtn) {
      els.toggleVisibleBtn.disabled = !obj;
      els.toggleVisibleBtn.textContent = obj && obj.visible === false ? 'Mostrar camada' : 'Ocultar camada';
    }
    if (els.toggleLockBtn) {
      els.toggleLockBtn.disabled = !obj;
      els.toggleLockBtn.textContent = obj && obj.locked ? 'Desbloquear camada' : 'Bloquear camada';
    }
  }

  function updateMapButtons() {
    const locked = !!T.state.settings.mapLocked;
    ['fitMapBtn', 'zoomInBtn', 'zoomOutBtn'].forEach(function (id) {
      if (els[id]) els[id].disabled = locked;
    });
    document.querySelectorAll('[data-tool="pan"]').forEach(function (button) {
      button.disabled = locked;
    });
    if (locked && T.state.tool === 'pan') {
      T.state.tool = 'select';
      document.querySelectorAll('[data-tool]').forEach(function (button) {
        button.classList.toggle('active', button.dataset.tool === 'select');
      });
      if (els.toolHint) els.toolHint.textContent = toolHints.select || '';
    }
  }

  function refreshLayerList() {
    if (!els.objectList) return;
    els.objectList.innerHTML = '';
    const groups = {};
    typeOrder.forEach(function (type) { groups[type] = []; });
    T.state.objects.forEach(function (obj) { (groups[obj.type] || (groups[obj.type] = [])).push(obj); });

    appendMapBaseLayer();

    if (!T.state.objects.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-message';
      empty.textContent = 'Nenhuma camada criada ainda.';
      els.objectList.appendChild(empty);
      return;
    }

    typeOrder.forEach(function (type) {
      if (!groups[type] || !groups[type].length) return;
      const header = document.createElement('div');
      header.className = 'layer-group';
      header.textContent = typeLabels[type] || type;
      els.objectList.appendChild(header);

      groups[type].slice().reverse().forEach(function (obj) {
        const div = document.createElement('div');
        div.className = 'layer-item' + (obj.id === T.state.selectedId ? ' selected' : '') + (obj.locked ? ' locked' : '') + (obj.visible === false ? ' hidden-layer' : '');
        const nodes = obj.points ? obj.points.filter(function (p) { return p.nodeId && T.store.connectedCount(p.nodeId) > 1; }).length : 0;
        const label = obj.name || defaultLayerName(obj);
        const status = [
          obj.visible === false ? '<span class="state-pill is-hidden">oculta</span>' : '<span class="state-pill">visível</span>',
          obj.locked ? '<span class="state-pill locked">bloqueada</span>' : '<span class="state-pill">livre</span>'
        ].join('');

        div.innerHTML = '<div class="layer-head"><div class="layer-title"><strong>' + utils.escapeHtml(label) + '</strong><small>' + (typeLabels[obj.type] || obj.type) + (nodes ? ' · <span class="node-badge">' + nodes + ' junção(ões)</span>' : '') + '</small><div class="layer-state">' + status + '</div></div><div class="layer-actions"><button type="button" title="Mostrar/ocultar" data-action="visible">' + (obj.visible === false ? '🙈' : '👁') + '</button><button type="button" title="Bloquear/desbloquear" data-action="lock">' + (obj.locked ? '🔒' : '🔓') + '</button></div></div>';

        div.addEventListener('click', function () {
          T.store.selectObject(obj.id);
          refreshProperties();
          refreshLayerList();
          T.drawing.draw();
        });

        div.querySelector('[data-action="visible"]').addEventListener('click', function (event) {
          event.stopPropagation();
          T.store.toggleVisibility(obj.id);
          T.store.selectObject(obj.id);
          refreshProperties();
          refreshLayerList();
          T.drawing.draw();
          T.storage.autoSave();
        });
        div.querySelector('[data-action="lock"]').addEventListener('click', function (event) {
          event.stopPropagation();
          T.store.toggleLock(obj.id);
          T.store.selectObject(obj.id);
          refreshProperties();
          refreshLayerList();
          T.drawing.draw();
          T.storage.autoSave();
        });

        els.objectList.appendChild(div);
      });
    });
  }

  function appendMapBaseLayer() {
    const header = document.createElement('div');
    header.className = 'layer-group';
    header.textContent = 'Mapa base';
    els.objectList.appendChild(header);

    const visible = T.state.settings.mapVisible !== false;
    const locked = !!T.state.settings.mapLocked;
    const div = document.createElement('div');
    div.className = 'layer-item map-base-layer' + (!visible ? ' hidden-layer' : '') + (locked ? ' locked' : '');
    div.innerHTML = '<div class="layer-head"><div class="layer-title"><strong>Imagem do mapa</strong><small>' + (T.state.image ? 'Mapa carregado' : 'Nenhum mapa carregado') + '</small><div class="layer-state"><span class="state-pill ' + (visible ? '' : 'is-hidden') + '">' + (visible ? 'visível' : 'oculto') + '</span><span class="state-pill ' + (locked ? 'locked' : '') + '">' + (locked ? 'bloqueado' : 'livre') + '</span></div></div><div class="layer-actions"><button type="button" title="Exibir/ocultar mapa" data-action="map-visible">' + (visible ? 'Ocultar' : 'Mostrar') + '</button><button type="button" title="Bloquear/desbloquear mapa" data-action="map-lock">' + (locked ? 'Desbloquear' : 'Bloquear') + '</button></div></div>';

    div.querySelector('[data-action="map-visible"]').addEventListener('click', function (event) {
      event.stopPropagation();
      T.state.settings.mapVisible = !visible;
      refreshAll();
      T.drawing.draw();
      T.storage.autoSave();
    });
    div.querySelector('[data-action="map-lock"]').addEventListener('click', function (event) {
      event.stopPropagation();
      T.state.settings.mapLocked = !locked;
      if (T.state.settings.mapLocked && T.state.tool === 'pan') setTool('select');
      refreshAll();
      T.drawing.draw();
      T.storage.autoSave();
    });

    els.objectList.appendChild(div);
  }

  function defaultLayerName(obj) {
    return { road: 'Rua', text: 'Texto', point: 'Ponto', area: 'Área', focus: 'Foco', compass: 'Bússola', legend: 'Legenda' }[obj.type] || 'Item';
  }

  function refreshLocalProjects() {
    if (!els.localProjectsSelect || !T.storage) return;
    const index = T.storage.getIndex();
    els.localProjectsSelect.innerHTML = '';
    if (!index.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Nenhum mapa salvo';
      els.localProjectsSelect.appendChild(option);
      return;
    }
    index.forEach(function (item) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = (item.name || item.id) + ' — ' + new Date(item.savedAt).toLocaleString('pt-BR');
      els.localProjectsSelect.appendChild(option);
    });
  }

  function refreshVersions() {
    if (!els.versionSelect || !T.storage) return;
    const id = T.storage.currentProjectId(T.store.currentProject());
    const versions = T.storage.getVersions(id);
    els.versionSelect.innerHTML = '';
    if (!versions.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Nenhuma versão salva';
      els.versionSelect.appendChild(option);
      return;
    }
    versions.forEach(function (version) {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = new Date(version.savedAt).toLocaleString('pt-BR') + ' · ' + (version.note || 'versão');
      els.versionSelect.appendChild(option);
    });
  }

  function updateDrawingButtons() {
    if (els.finishRoadBtn) els.finishRoadBtn.disabled = T.state.drawingRoad.length < 2;
    if (els.finishAreaBtn) els.finishAreaBtn.disabled = T.state.drawingArea.length < 3;
    if (els.cancelDrawingBtn) els.cancelDrawingBtn.disabled = T.state.drawingRoad.length === 0 && T.state.drawingArea.length === 0 && !T.state.drawingFocus;
  }

  function updateUndoRedoButtons() {
    if (els.undoBtn) els.undoBtn.disabled = !T.store.canUndo();
    if (els.redoBtn) els.redoBtn.disabled = !T.store.canRedo();
  }

  function updatePointButtons() {
    const obj = T.store.selectedObject();
    const selectedPoint = T.state.selectedPoint;
    if (els.removePointBtn) els.removePointBtn.disabled = !selectedPoint || !obj || !obj.points || obj.locked;
    if (els.splitRoadBtn) els.splitRoadBtn.disabled = !(selectedPoint && obj && obj.type === 'road' && selectedPoint.index > 0 && selectedPoint.index < obj.points.length - 1 && !obj.locked);
  }

  function updateFloatingHelp() {
    if (!els.floatingHelp) return;
    let message = T.state.image ? toolHints[T.state.tool] : 'Carregue uma imagem do mapa para começar.';
    const selected = T.store.selectedObject();
    if (T.state.connectDraft) message = 'Conectar: primeiro nó selecionado. Toque no segundo nó para criar a junção.';
    if (T.state.selectedPoint) message = 'Ponto selecionado. Arraste para mover, remova o ponto ou divida a rua se for um ponto intermediário.';
    if (selected && selected.locked) message = 'Camada bloqueada. Desbloqueie no painel ou na lista de camadas para editar.';
    if (selected && selected.visible === false) message = 'Camada oculta selecionada. Use “Mostrar camada” ou o olho na lista para exibir novamente.';
    els.floatingHelp.textContent = message || '';
  }

  function applyPropertyInput() {
    const obj = T.store.selectedObject();
    if (!obj) return;
    obj.name = els.nameInput.value;
    obj.color = els.colorInput.value;
    obj.backgroundColor = els.backgroundColorInput.value;
    obj.borderColor = els.borderColorInput.value;
    obj.size = Number(els.sizeInput.value) || 1;
    obj.borderWidth = Number(els.borderWidthInput.value) || 0;
    obj.opacity = Number(els.opacityInput.value);
    obj.rotation = Number(els.rotationInput.value) || 0;
    obj.shape = els.shapeInput.value;
    obj.icon = els.iconInput.value;
    obj.rounded = els.roundedInput.checked;
    obj.smooth = els.smoothInput.checked;
    obj.visible = els.visibleInput.checked;
    obj.locked = els.lockedInput.checked;
    if (T.store.rememberStyle) T.store.rememberStyle(obj);
    updateSelectionStatus(obj);
    updateLockedFields(obj);
    refreshLayerList();
    updatePointButtons();
    updateFloatingHelp();
    T.drawing.draw();
    T.storage.autoSave();
  }

  function bindPropertyInputs() {
    [els.nameInput, els.colorInput, els.backgroundColorInput, els.borderColorInput, els.sizeInput, els.borderWidthInput, els.opacityInput, els.rotationInput, els.shapeInput, els.iconInput, els.roundedInput, els.smoothInput, els.visibleInput, els.lockedInput].filter(Boolean).forEach(function (input) {
      input.addEventListener('focus', function () { if (T.store.selectedObject() && !input.disabled) T.store.pushHistory(); });
      input.addEventListener('input', applyPropertyInput);
      input.addEventListener('change', applyPropertyInput);
    });
  }

  function bindSettingsInputs() {
    if (els.projectNameInput) els.projectNameInput.addEventListener('input', function () { T.state.projectName = els.projectNameInput.value; T.storage.autoSave(); refreshVersions(); });
    if (els.snapEnabledInput) els.snapEnabledInput.addEventListener('change', function () { T.state.settings.snapEnabled = els.snapEnabledInput.checked; T.storage.autoSave(); });
    if (els.snapDistanceInput) els.snapDistanceInput.addEventListener('input', function () { T.state.settings.snapDistance = Number(els.snapDistanceInput.value) || 22; });
    if (els.autoSaveInput) els.autoSaveInput.addEventListener('change', function () { T.state.settings.autoSave = els.autoSaveInput.checked; T.storage.autoSave(); });
    if (els.showNodesInput) els.showNodesInput.addEventListener('change', function () { T.state.settings.showNodes = els.showNodesInput.checked; T.drawing.draw(); T.storage.autoSave(); });
    if (els.nodeLabelsInput) els.nodeLabelsInput.addEventListener('change', function () { T.state.settings.nodeLabels = els.nodeLabelsInput.checked; T.drawing.draw(); T.storage.autoSave(); });
    if (els.mapVisibleInput) els.mapVisibleInput.addEventListener('change', function () {
      T.state.settings.mapVisible = els.mapVisibleInput.checked;
      refreshLayerList();
      T.drawing.draw();
      T.storage.autoSave();
    });
    if (els.mapLockedInput) els.mapLockedInput.addEventListener('change', function () {
      T.state.settings.mapLocked = els.mapLockedInput.checked;
      if (T.state.settings.mapLocked && T.state.tool === 'pan') setTool('select');
      updateMapButtons();
      refreshLayerList();
      T.drawing.draw();
      T.storage.autoSave();
    });
  }

  T.ui = { setup, els, setTool, refreshAll, refreshProperties, refreshLayerList, refreshLocalProjects, refreshVersions, updateDrawingButtons, updateUndoRedoButtons, updatePointButtons, updateFloatingHelp, bindPropertyInputs, bindSettingsInputs, defaultLayerName, updateMapButtons };
})();
