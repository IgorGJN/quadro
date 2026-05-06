(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;
  const els = {};

  const typeLabels = { road: 'Rua', text: 'Nome/Número', point: 'Ponto', area: 'Área', focus: 'Foco', compass: 'Bússola', legend: 'Legenda' };
  const typeOrder = ['road', 'text', 'point', 'area', 'focus', 'compass', 'legend'];

  const toolHints = {
    select: 'Selecionar: toque em um item para selecionar. Arraste área vazia para mover o mapa. Arraste item para mover.',
    edit: 'Editar pontos: selecione uma rua/área. Toque em um nó para mover; toque em um segmento para inserir novo ponto.',
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
      'emptySelectionMessage', 'toolHint', 'floatingHelp', 'nodeHint'
    ].forEach(function (id) { els[id] = document.getElementById(id); });
  }

  function setTool(tool) {
    T.state.tool = tool;
    if (tool !== 'connect') T.state.connectDraft = null;
    document.querySelectorAll('[data-tool]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.tool === tool);
    });
    els.toolHint.textContent = toolHints[tool] || '';
    updateFloatingHelp();
    T.drawing.draw();
  }

  function refreshAll() {
    els.projectNameInput.value = T.state.projectName || '';
    els.snapEnabledInput.checked = !!T.state.settings.snapEnabled;
    els.snapDistanceInput.value = T.state.settings.snapDistance || 22;
    els.autoSaveInput.checked = !!T.state.settings.autoSave;
    els.showNodesInput.checked = !!T.state.settings.showNodes;
    els.nodeLabelsInput.checked = !!T.state.settings.nodeLabels;
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
    els.propertiesPanel.classList.toggle('hidden', !obj);
    els.emptySelectionMessage.classList.toggle('hidden', !!obj);
    if (!obj) return;

    els.nameInput.value = obj.name || '';
    els.colorInput.value = obj.color || '#2563eb';
    els.backgroundColorInput.value = obj.backgroundColor || '#ffffff';
    els.borderColorInput.value = obj.borderColor || '#ffffff';
    els.sizeInput.value = obj.size || 16;
    els.borderWidthInput.value = obj.borderWidth || 0;
    els.opacityInput.value = obj.opacity ?? 0.45;
    els.rotationInput.value = obj.rotation || 0;
    els.shapeInput.value = obj.shape || 'rect';
    els.iconInput.value = obj.icon || '●';
    els.roundedInput.checked = obj.rounded !== false;
    els.smoothInput.checked = !!obj.smooth;
    els.visibleInput.checked = obj.visible !== false;
    els.lockedInput.checked = !!obj.locked;

    configureLabels(obj.type);
    showRelevantFields(obj.type);
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
    els.centerFocusBtn.classList.toggle('hidden', type !== 'focus');
  }

  function refreshLayerList() {
    els.objectList.innerHTML = '';
    const groups = {};
    typeOrder.forEach(function (type) { groups[type] = []; });
    T.state.objects.forEach(function (obj) { (groups[obj.type] || (groups[obj.type] = [])).push(obj); });

    typeOrder.forEach(function (type) {
      if (!groups[type] || !groups[type].length) return;
      const header = document.createElement('div');
      header.className = 'layer-group';
      header.textContent = typeLabels[type] || type;
      els.objectList.appendChild(header);

      groups[type].slice().reverse().forEach(function (obj) {
        const div = document.createElement('div');
        div.className = 'layer-item' + (obj.id === T.state.selectedId ? ' selected' : '') + (obj.locked ? ' locked' : '');
        const nodes = obj.points ? obj.points.filter(function (p) { return p.nodeId && T.store.connectedCount(p.nodeId) > 1; }).length : 0;
        const label = obj.name || defaultLayerName(obj);
        div.innerHTML = '<div class="layer-head"><div class="layer-title"><strong>' + utils.escapeHtml(label) + '</strong><small>' + (typeLabels[obj.type] || obj.type) + (nodes ? ' · <span class="node-badge">' + nodes + ' junção(ões)</span>' : '') + '</small></div><div class="layer-actions"><button data-action="visible">' + (obj.visible === false ? '🙈' : '👁') + '</button><button data-action="lock">' + (obj.locked ? '🔒' : '🔓') + '</button></div></div>';

        div.addEventListener('click', function () {
          T.store.selectObject(obj.id);
          refreshProperties();
          refreshLayerList();
          T.drawing.draw();
        });

        div.querySelector('[data-action="visible"]').addEventListener('click', function (event) {
          event.stopPropagation();
          T.store.toggleVisibility(obj.id);
          refreshLayerList();
          T.drawing.draw();
          T.storage.autoSave();
        });
        div.querySelector('[data-action="lock"]').addEventListener('click', function (event) {
          event.stopPropagation();
          T.store.toggleLock(obj.id);
          refreshProperties();
          refreshLayerList();
          T.drawing.draw();
          T.storage.autoSave();
        });

        els.objectList.appendChild(div);
      });
    });
  }

  function defaultLayerName(obj) {
    return { road: 'Rua', text: 'Texto', point: 'Ponto', area: 'Área', focus: 'Foco', compass: 'Bússola', legend: 'Legenda' }[obj.type] || 'Item';
  }

  function refreshLocalProjects() {
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
    els.finishRoadBtn.disabled = T.state.drawingRoad.length < 2;
    els.finishAreaBtn.disabled = T.state.drawingArea.length < 3;
    els.cancelDrawingBtn.disabled = T.state.drawingRoad.length === 0 && T.state.drawingArea.length === 0 && !T.state.drawingFocus;
  }

  function updateUndoRedoButtons() {
    els.undoBtn.disabled = !T.store.canUndo();
    els.redoBtn.disabled = !T.store.canRedo();
  }

  function updatePointButtons() {
    const obj = T.store.selectedObject();
    const selectedPoint = T.state.selectedPoint;
    els.removePointBtn.disabled = !selectedPoint || !obj || !obj.points || obj.locked;
    els.splitRoadBtn.disabled = !(selectedPoint && obj && obj.type === 'road' && selectedPoint.index > 0 && selectedPoint.index < obj.points.length - 1 && !obj.locked);
  }

  function updateFloatingHelp() {
    let message = T.state.image ? toolHints[T.state.tool] : 'Carregue uma imagem do mapa para começar.';
    if (T.state.connectDraft) message = 'Conectar: primeiro nó selecionado. Toque no segundo nó para criar a junção.';
    if (T.state.selectedPoint) message = 'Ponto selecionado. Arraste para mover, remova o ponto ou divida a rua se for um ponto intermediário.';
    els.floatingHelp.textContent = message;
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
    refreshLayerList();
    updatePointButtons();
    T.drawing.draw();
    T.storage.autoSave();
  }

  function bindPropertyInputs() {
    [els.nameInput, els.colorInput, els.backgroundColorInput, els.borderColorInput, els.sizeInput, els.borderWidthInput, els.opacityInput, els.rotationInput, els.shapeInput, els.iconInput, els.roundedInput, els.smoothInput, els.visibleInput, els.lockedInput].forEach(function (input) {
      input.addEventListener('focus', function () { if (T.store.selectedObject()) T.store.pushHistory(); });
      input.addEventListener('input', applyPropertyInput);
      input.addEventListener('change', applyPropertyInput);
    });
  }

  function bindSettingsInputs() {
    els.projectNameInput.addEventListener('input', function () { T.state.projectName = els.projectNameInput.value; T.storage.autoSave(); refreshVersions(); });
    els.snapEnabledInput.addEventListener('change', function () { T.state.settings.snapEnabled = els.snapEnabledInput.checked; T.storage.autoSave(); });
    els.snapDistanceInput.addEventListener('input', function () { T.state.settings.snapDistance = Number(els.snapDistanceInput.value) || 22; });
    els.autoSaveInput.addEventListener('change', function () { T.state.settings.autoSave = els.autoSaveInput.checked; T.storage.autoSave(); });
    els.showNodesInput.addEventListener('change', function () { T.state.settings.showNodes = els.showNodesInput.checked; T.drawing.draw(); T.storage.autoSave(); });
    els.nodeLabelsInput.addEventListener('change', function () { T.state.settings.nodeLabels = els.nodeLabelsInput.checked; T.drawing.draw(); T.storage.autoSave(); });
  }

  T.ui = { setup, els, setTool, refreshAll, refreshProperties, refreshLayerList, refreshLocalProjects, refreshVersions, updateDrawingButtons, updateUndoRedoButtons, updatePointButtons, updateFloatingHelp, bindPropertyInputs, bindSettingsInputs, defaultLayerName };
})();
