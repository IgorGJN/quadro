(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const clone = T.utils.clone;

  const state = {
    projectName: '',
    imageData: null,
    image: null,
    objects: [],
    selectedId: null,
    tool: 'select',

    scale: 1,
    offsetX: 0,
    offsetY: 0,

    drawingRoad: [],
    drawingArea: [],
    drawingFocus: null,
    snapPreview: null,

    drag: {
      active: false,
      mode: null,
      lastX: 0,
      lastY: 0,
      pinchStartDistance: 0,
      pinchStartScale: 1,
      pinchStartOffsetX: 0,
      pinchStartOffsetY: 0,
      pinchStartCenter: null
    },

    settings: {
      snapEnabled: true,
      snapDistance: 18,
      autoSave: false
    },

    historyPast: [],
    historyFuture: [],
    maxHistory: 80
  };

  function snapshot() {
    return {
      projectName: state.projectName,
      imageData: state.imageData,
      objects: clone(state.objects),
      selectedId: state.selectedId,
      settings: clone(state.settings)
    };
  }

  function restore(snapshotValue) {
    state.projectName = snapshotValue.projectName || '';
    state.imageData = snapshotValue.imageData || null;
    state.objects = snapshotValue.objects || [];
    state.selectedId = snapshotValue.selectedId || null;
    state.settings = Object.assign({}, state.settings, snapshotValue.settings || {});
  }

  function pushHistory() {
    state.historyPast.push(snapshot());
    if (state.historyPast.length > state.maxHistory) {
      state.historyPast.shift();
    }
    state.historyFuture = [];
  }

  function canUndo() {
    return state.historyPast.length > 0;
  }

  function canRedo() {
    return state.historyFuture.length > 0;
  }

  function undo() {
    if (!canUndo()) return false;
    const current = snapshot();
    const previous = state.historyPast.pop();
    state.historyFuture.push(current);
    restore(previous);
    return true;
  }

  function redo() {
    if (!canRedo()) return false;
    const current = snapshot();
    const next = state.historyFuture.pop();
    state.historyPast.push(current);
    restore(next);
    return true;
  }

  function selectedObject() {
    return state.objects.find(function (obj) {
      return obj.id === state.selectedId;
    }) || null;
  }

  function selectObject(id) {
    state.selectedId = id || null;
  }

  function addObject(obj) {
    pushHistory();
    const item = Object.assign({
      id: T.utils.uid(),
      name: '',
      color: '#2563eb',
      borderColor: '#ffffff',
      borderWidth: 0,
      size: 18,
      opacity: 0.45,
      rotation: 0,
      rounded: true,
      smooth: false
    }, obj);

    state.objects.push(item);
    state.selectedId = item.id;
    return item;
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    pushHistory();
    state.objects = state.objects.filter(function (obj) {
      return obj.id !== state.selectedId;
    });
    state.selectedId = null;
  }

  function duplicateSelected() {
    const obj = selectedObject();
    if (!obj) return;
    pushHistory();

    const copy = clone(obj);
    copy.id = T.utils.uid();

    if (copy.points) {
      copy.points = copy.points.map(function (p) {
        return { x: p.x + 20, y: p.y + 20 };
      });
    } else {
      copy.x = (copy.x || 0) + 20;
      copy.y = (copy.y || 0) + 20;
    }

    state.objects.push(copy);
    state.selectedId = copy.id;
  }

  function bringForward() {
    const index = state.objects.findIndex(function (obj) {
      return obj.id === state.selectedId;
    });
    if (index < 0 || index === state.objects.length - 1) return;
    pushHistory();
    const temp = state.objects[index];
    state.objects[index] = state.objects[index + 1];
    state.objects[index + 1] = temp;
  }

  function sendBackward() {
    const index = state.objects.findIndex(function (obj) {
      return obj.id === state.selectedId;
    });
    if (index <= 0) return;
    pushHistory();
    const temp = state.objects[index];
    state.objects[index] = state.objects[index - 1];
    state.objects[index - 1] = temp;
  }

  function currentProject() {
    return {
      version: 3,
      projectName: state.projectName || 'mapa-territorio',
      imageData: state.imageData,
      objects: state.objects,
      settings: state.settings,
      savedAt: new Date().toISOString()
    };
  }

  function loadProject(project) {
    state.projectName = project.projectName || '';
    state.imageData = project.imageData || null;
    state.objects = project.objects || [];
    state.settings = Object.assign({}, state.settings, project.settings || {});
    state.selectedId = null;
    state.drawingRoad = [];
    state.drawingArea = [];
    state.drawingFocus = null;
    state.snapPreview = null;
    state.historyPast = [];
    state.historyFuture = [];
  }

  T.state = state;
  T.store = {
    snapshot,
    restore,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedObject,
    selectObject,
    addObject,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    currentProject,
    loadProject
  };
})();
