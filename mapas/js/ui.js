(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  const els = {};

  const typeLabels = {
    road: 'Rua',
    text: 'Nome/Número',
    point: 'Ponto',
    area: 'Área',
    focus: 'Foco',
    compass: 'Bússola',
    legend: 'Legenda'
  };

  const toolHints = {
    select: 'Toque em um item para selecionar. Arraste o item selecionado para mover. Arraste área vazia para mover o mapa.',
    road: 'Toque ponto por ponto para desenhar a rua. Use “Concluir rua” ao terminar. Pontos próximos podem encaixar em ruas existentes.',
    text: 'Toque no mapa para inserir um nome, número ou observação. Depois ajuste rotação, tamanho e borda.',
    point: 'Toque no mapa para inserir um ponto de referência.',
    area: 'Toque ponto por ponto para desenhar uma área ou território. Ela pode ser côncava. Use “Concluir área” ao terminar.',
    focus: 'Toque e arraste para criar uma área de foco. O interior fica limpo e o exterior recebe máscara.',
    compass: 'Toque no mapa para inserir a bússola. Ajuste tamanho e rotação se necessário.',
    legend: 'Toque no mapa para inserir a legenda. Depois selecione a legenda e edite o texto em múltiplas linhas.'
  };

  const fieldsByType = {
    road: ['color', 'border-color', 'size', 'border-width', 'rounded', 'smooth'],
    text: ['name', 'color', 'border-color', 'size', 'border-width', 'rotation'],
    point: ['name', 'color', 'border-color', 'size', 'border-width', 'rotation', 'icon'],
    area: ['name', 'color', 'border-color', 'size', 'border-width', 'opacity', 'smooth'],
    focus: ['name', 'color', 'border-color', 'size', 'border-width', 'opacity', 'rotation'],
    compass: ['color', 'size', 'border-width', 'rotation'],
    legend: ['name', 'color', 'border-color', 'size', 'border-width', 'opacity']
  };

  function setup() {
    [
      'imageInput', 'projectInput', 'downloadJsonBtn', 'saveLocalBtn', 'openLocalBtn',
      'deleteLocalBtn', 'newProjectBtn', 'exportPngBtn', 'finishRoadBtn',
      'finishAreaBtn', 'cancelDrawingBtn', 'projectNameInput', 'localProjectsSelect',
      'autoSaveInput', 'nameInput', 'colorInput', 'borderColorInput', 'sizeInput',
      'borderWidthInput', 'opacityInput', 'rotationInput', 'iconInput', 'roundedInput',
      'smoothInput', 'duplicateBtn', 'bringForwardBtn', 'sendBackwardBtn', 'deleteBtn',
      'snapEnabledInput', 'snapDistanceInput', 'undoBtn', 'redoBtn', 'fitMapBtn',
      'objectList', 'propertiesPanel', 'emptySelectionMessage', 'toolHint',
      'floatingHelp'
    ].forEach(function (id) {
      els[id] = document.getElementById(id);
    });

    T.ui = Object.assign(T.ui || {}, {
      els,
      setTool,
      refreshAll,
      refreshProperties,
      refreshLayerList,
      refreshLocalProjects,
      updateDrawingButtons
    });
  }

  function setTool(tool) {
    T.state.tool = tool;

    document.querySelectorAll('[data-tool]').forEach(function (button) {
      button.classList.toggle('active', button.dataset.tool === tool);
    });

    els.toolHint.textContent = toolHints[tool] || '';
    T.drawing.draw();
  }

  function refreshAll() {
    els.projectNameInput.value = T.state.projectName || '';
    els.snapEnabledInput.checked = !!T.state.settings.snapEnabled;
    els.snapDistanceInput.value = T.state.settings.snapDistance || 18;
    els.autoSaveInput.checked = !!T.state.settings.autoSave;
    refreshProperties();
    refreshLayerList();
    refreshLocalProjects();
    updateDrawingButtons();
    updateUndoRedoButtons();
    updateFloatingHelp();
  }

  function refreshProperties() {
    const obj = T.store.selectedObject();

    els.propertiesPanel.classList.toggle('hidden', !obj);
    els.emptySelectionMessage.classList.toggle('hidden', !!obj);

    if (!obj) return;

    els.nameInput.value = obj.name || '';
    els.colorInput.value = obj.color || '#2563eb';
    els.borderColorInput.value = obj.borderColor || '#ffffff';
    els.sizeInput.value = obj.size || 16;
    els.borderWidthInput.value = obj.borderWidth || 0;
    els.opacityInput.value = obj.opacity ?? 0.45;
    els.rotationInput.value = obj.rotation || 0;
    els.iconInput.value = obj.icon || '●';
    els.roundedInput.checked = obj.rounded !== false;
    els.smoothInput.checked = !!obj.smooth;

    configureLabels(obj.type);
    showRelevantFields(obj.type);
  }

  function configureLabels(type) {
    const nameLabel = document.getElementById('nameLabel');
    const colorLabel = document.getElementById('colorLabel');
    const borderColorLabel = document.getElementById('borderColorLabel');
    const sizeLabel = document.getElementById('sizeLabel');
    const borderWidthLabel = document.getElementById('borderWidthLabel');
    const opacityLabel = document.getElementById('opacityLabel');

    nameLabel.textContent = type === 'legend' ? 'Texto da legenda' : 'Texto/nome';
    colorLabel.textContent = type === 'focus' ? 'Cor da máscara externa' : type === 'legend' ? 'Cor do texto' : 'Cor principal';
    borderColorLabel.textContent = type === 'focus' ? 'Cor do contorno do foco' : 'Cor da borda';
    sizeLabel.textContent = type === 'road' ? 'Largura da rua' : type === 'area' ? 'Tamanho do texto da área' : 'Tamanho';
    borderWidthLabel.textContent = type === 'road' ? 'Espessura da borda da rua' : 'Espessura da borda';
    opacityLabel.textContent = type === 'focus' ? 'Opacidade da máscara externa' : type === 'area' ? 'Opacidade do preenchimento' : 'Transparência do fundo';
  }

  function showRelevantFields(type) {
    const visible = new Set(fieldsByType[type] || []);

    [
      'name', 'color', 'border-color', 'size', 'border-width', 'opacity',
      'rotation', 'icon', 'rounded', 'smooth'
    ].forEach(function (name) {
      document.querySelectorAll('.field-' + name).forEach(function (el) {
        el.classList.toggle('hidden', !visible.has(name));
      });
    });
  }

  function refreshLayerList() {
    els.objectList.innerHTML = '';

    T.state.objects.slice().reverse().forEach(function (obj) {
      const div = document.createElement('div');
      div.className = 'layer-item' + (obj.id === T.state.selectedId ? ' selected' : '');

      const label = obj.name || defaultLayerName(obj);
      div.innerHTML = '<strong>' + utils.escapeHtml(label) + '</strong><small>' + (typeLabels[obj.type] || obj.type) + '</small>';

      div.addEventListener('click', function () {
        T.store.selectObject(obj.id);
        refreshProperties();
        refreshLayerList();
        T.drawing.draw();
      });

      els.objectList.appendChild(div);
    });
  }

  function defaultLayerName(obj) {
    return {
      road: 'Rua',
      text: 'Texto',
      point: 'Ponto',
      area: 'Área',
      focus: 'Foco',
      compass: 'Bússola',
      legend: 'Legenda'
    }[obj.type] || 'Item';
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

  function updateDrawingButtons() {
    const roadCount = T.state.drawingRoad.length;
    const areaCount = T.state.drawingArea.length;

    els.finishRoadBtn.disabled = roadCount < 2;
    els.finishAreaBtn.disabled = areaCount < 3;
    els.cancelDrawingBtn.disabled = roadCount === 0 && areaCount === 0 && !T.state.drawingFocus;
  }

  function updateUndoRedoButtons() {
    els.undoBtn.disabled = !T.store.canUndo();
    els.redoBtn.disabled = !T.store.canRedo();
  }

  function updateFloatingHelp() {
    const message = T.state.image ? toolHints[T.state.tool] : 'Carregue uma imagem do mapa para começar.';
    els.floatingHelp.textContent = message;
  }

  function applyPropertyInput() {
    const obj = T.store.selectedObject();
    if (!obj) return;

    obj.name = els.nameInput.value;
    obj.color = els.colorInput.value;
    obj.borderColor = els.borderColorInput.value;
    obj.size = Number(els.sizeInput.value) || 1;
    obj.borderWidth = Number(els.borderWidthInput.value) || 0;
    obj.opacity = Number(els.opacityInput.value);
    obj.rotation = Number(els.rotationInput.value) || 0;
    obj.icon = els.iconInput.value;
    obj.rounded = els.roundedInput.checked;
    obj.smooth = els.smoothInput.checked;

    refreshLayerList();
    T.drawing.draw();
    T.storage.autoSave();
  }

  function bindPropertyInputs() {
    [
      els.nameInput, els.colorInput, els.borderColorInput, els.sizeInput,
      els.borderWidthInput, els.opacityInput, els.rotationInput, els.iconInput,
      els.roundedInput, els.smoothInput
    ].forEach(function (input) {
      input.addEventListener('focus', function () {
        if (T.store.selectedObject()) T.store.pushHistory();
      });

      input.addEventListener('input', applyPropertyInput);
      input.addEventListener('change', applyPropertyInput);
    });
  }

  function bindSettingsInputs() {
    els.projectNameInput.addEventListener('input', function () {
      T.state.projectName = els.projectNameInput.value;
      T.storage.autoSave();
    });

    els.snapEnabledInput.addEventListener('change', function () {
      T.state.settings.snapEnabled = els.snapEnabledInput.checked;
      T.storage.autoSave();
    });

    els.snapDistanceInput.addEventListener('input', function () {
      T.state.settings.snapDistance = Number(els.snapDistanceInput.value) || 18;
    });

    els.autoSaveInput.addEventListener('change', function () {
      T.state.settings.autoSave = els.autoSaveInput.checked;
      T.storage.autoSave();
    });
  }

  T.ui = {
    setup,
    els,
    setTool,
    refreshAll,
    refreshProperties,
    refreshLayerList,
    refreshLocalProjects,
    updateDrawingButtons,
    updateUndoRedoButtons,
    updateFloatingHelp,
    bindPropertyInputs,
    bindSettingsInputs,
    defaultLayerName
  };
})();
