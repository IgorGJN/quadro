(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  const state = {
    projectName: '',
    imageData: null,
    image: null,
    objects: [],
    nodes: [],
    selectedId: null,
    selectedPoint: null,
    tool: 'select',

    scale: 1,
    offsetX: 0,
    offsetY: 0,

    drawingRoad: [],
    drawingArea: [],
    drawingFocus: null,
    snapPreview: null,
    connectDraft: null,

    drag: {
      active: false,
      mode: null,
      lastX: 0,
      lastY: 0,
      draggedNodeId: null,
      draggedPoint: null,
      pinchStartDistance: 0,
      pinchStartScale: 1,
      pinchStartCenter: null
    },

    settings: {
      snapEnabled: true,
      snapDistance: 22,
      autoSave: false,
      showNodes: true,
      nodeLabels: true,
      mapVisible: true,
      mapLocked: false,
      defaultStyles: {}
    },

    historyPast: [],
    historyFuture: [],
    maxHistory: 120
  };


  const styleKeysByType = {
    road: ['color', 'borderColor', 'borderWidth', 'size', 'rounded', 'smooth'],
    text: ['color', 'borderColor', 'borderWidth', 'size', 'rotation'],
    point: ['icon', 'color', 'borderColor', 'borderWidth', 'size', 'rotation'],
    area: ['color', 'borderColor', 'borderWidth', 'size', 'opacity', 'rounded', 'smooth'],
    focus: ['color', 'borderColor', 'borderWidth', 'size', 'opacity', 'rotation', 'shape'],
    compass: ['color', 'borderColor', 'borderWidth', 'size', 'rotation'],
    legend: ['name', 'color', 'backgroundColor', 'borderColor', 'borderWidth', 'size', 'opacity']
  };

  const baseDefaultsByType = {
    road: { color: '#2563eb', borderColor: '#ffffff', borderWidth: 0, size: 8, rounded: true, smooth: false },
    text: { color: '#111827', borderColor: '#ffffff', borderWidth: 4, size: 18, rotation: 0 },
    point: { icon: '●', color: '#dc2626', borderColor: '#ffffff', borderWidth: 0, size: 24, rotation: 0 },
    area: { color: '#facc15', borderColor: '#111827', borderWidth: 3, size: 16, opacity: 0.25, rounded: true, smooth: false },
    focus: { color: '#ffffff', borderColor: '#111827', borderWidth: 4, size: 16, opacity: 0.55, rotation: 0, shape: 'rect' },
    compass: { color: '#111827', borderColor: '#ffffff', borderWidth: 3, size: 60, rotation: 0 },
    legend: { name: 'Legenda\n● Ponto de referência\n— Rua\n▣ Área de foco', color: '#111827', backgroundColor: '#ffffff', borderColor: '#111827', borderWidth: 2, size: 16, opacity: 0.12 }
  };

  function normalizeSettings(settings) {
    const merged = Object.assign({}, state.settings, settings || {});
    merged.mapVisible = merged.mapVisible !== false;
    merged.mapLocked = !!merged.mapLocked;
    merged.defaultStyles = Object.assign({}, merged.defaultStyles || {});
    Object.keys(merged.defaultStyles).forEach(function (type) {
      merged.defaultStyles[type] = Object.assign({}, merged.defaultStyles[type] || {});
    });
    return merged;
  }

  function defaultStyle(type) {
    return Object.assign({}, baseDefaultsByType[type] || {}, (state.settings.defaultStyles && state.settings.defaultStyles[type]) || {});
  }

  function rememberStyle(obj) {
    if (!obj || !obj.type) return;
    const keys = styleKeysByType[obj.type] || [];
    if (!state.settings.defaultStyles) state.settings.defaultStyles = {};
    const current = Object.assign({}, state.settings.defaultStyles[obj.type] || {});
    keys.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) current[key] = utils.clone(obj[key]);
    });
    state.settings.defaultStyles[obj.type] = current;
  }

  function snapshot() {
    return {
      projectName: state.projectName,
      imageData: state.imageData,
      objects: utils.clone(state.objects),
      nodes: utils.clone(state.nodes),
      selectedId: state.selectedId,
      selectedPoint: utils.clone(state.selectedPoint),
      settings: utils.clone(state.settings)
    };
  }

  function restore(snapshotValue) {
    state.projectName = snapshotValue.projectName || '';
    state.imageData = snapshotValue.imageData || null;
    state.objects = snapshotValue.objects || [];
    state.nodes = snapshotValue.nodes || [];
    state.selectedId = snapshotValue.selectedId || null;
    state.selectedPoint = snapshotValue.selectedPoint || null;
    state.settings = normalizeSettings(snapshotValue.settings);
  }

  function pushHistory() {
    state.historyPast.push(snapshot());
    if (state.historyPast.length > state.maxHistory) state.historyPast.shift();
    state.historyFuture = [];
  }

  function canUndo() { return state.historyPast.length > 0; }
  function canRedo() { return state.historyFuture.length > 0; }

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
    return state.objects.find(function (obj) { return obj.id === state.selectedId; }) || null;
  }

  function objectById(id) {
    return state.objects.find(function (obj) { return obj.id === id; }) || null;
  }

  function nodeById(id) {
    return state.nodes.find(function (node) { return node.id === id; }) || null;
  }

  function selectObject(id) {
    state.selectedId = id || null;
    state.selectedPoint = null;
  }

  function selectPoint(objectId, index) {
    state.selectedId = objectId || null;
    state.selectedPoint = objectId ? { objectId: objectId, index: index } : null;
  }

  function pointPosition(point) {
    if (!point) return { x: 0, y: 0 };
    if (point.nodeId) {
      const node = nodeById(point.nodeId);
      if (node) return { x: node.x, y: node.y };
    }
    return { x: point.x || 0, y: point.y || 0 };
  }

  function objectPoints(obj) {
    return (obj.points || []).map(pointPosition);
  }

  function setPointPosition(point, x, y) {
    if (!point) return;
    point.x = x;
    point.y = y;
    if (point.nodeId) {
      const node = nodeById(point.nodeId);
      if (node) {
        node.x = x;
        node.y = y;
      }
    }
  }

  function createNode(x, y) {
    const node = { id: utils.uid('node'), x: x, y: y };
    state.nodes.push(node);
    return node;
  }

  function makePoint(x, y, nodeId) {
    const node = nodeId ? nodeById(nodeId) : null;
    return {
      x: node ? node.x : x,
      y: node ? node.y : y,
      nodeId: node ? node.id : nodeId || null
    };
  }

  function ensureNodeForPoint(point) {
    if (!point) return null;
    if (point.nodeId && nodeById(point.nodeId)) return nodeById(point.nodeId);
    const p = pointPosition(point);
    const node = createNode(p.x, p.y);
    point.x = node.x;
    point.y = node.y;
    point.nodeId = node.id;
    return node;
  }

  function ensureNodesForObject(obj) {
    if (!obj || !obj.points) return;
    obj.points.forEach(ensureNodeForPoint);
  }

  function normalizeObject(obj) {
    const item = Object.assign({
      id: utils.uid('obj'),
      name: '',
      color: '#2563eb',
      borderColor: '#ffffff',
      borderWidth: 0,
      size: 18,
      opacity: 0.45,
      rotation: 0,
      rounded: true,
      smooth: false,
      visible: true,
      locked: false
    }, obj);

    if (item.type === 'road') {
      item.size = item.size || 8;
      item.rounded = item.rounded !== false;
    }

    if (item.points) {
      item.points = item.points.map(function (point) {
        if (point.nodeId && nodeById(point.nodeId)) return makePoint(point.x, point.y, point.nodeId);
        return makePoint(point.x || 0, point.y || 0, point.nodeId || null);
      });
      ensureNodesForObject(item);
    }

    return item;
  }

  function addObject(obj) {
    pushHistory();
    const item = normalizeObject(obj);
    state.objects.push(item);
    state.selectedId = item.id;
    state.selectedPoint = null;
    cleanupUnusedNodes();
    return item;
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    pushHistory();
    state.objects = state.objects.filter(function (obj) { return obj.id !== state.selectedId; });
    state.selectedId = null;
    state.selectedPoint = null;
    cleanupUnusedNodes();
  }

  function duplicateSelected() {
    const obj = selectedObject();
    if (!obj) return;
    pushHistory();

    const copy = utils.clone(obj);
    copy.id = utils.uid('obj');
    copy.locked = false;
    copy.visible = true;

    if (copy.points) {
      copy.points = copy.points.map(function (p) {
        const pos = pointPosition(p);
        const node = createNode(pos.x + 20, pos.y + 20);
        return makePoint(node.x, node.y, node.id);
      });
    } else {
      copy.x = (copy.x || 0) + 20;
      copy.y = (copy.y || 0) + 20;
    }

    state.objects.push(copy);
    state.selectedId = copy.id;
    state.selectedPoint = null;
  }

  function bringForward() {
    const index = state.objects.findIndex(function (obj) { return obj.id === state.selectedId; });
    if (index < 0 || index === state.objects.length - 1) return;
    pushHistory();
    const temp = state.objects[index];
    state.objects[index] = state.objects[index + 1];
    state.objects[index + 1] = temp;
  }

  function sendBackward() {
    const index = state.objects.findIndex(function (obj) { return obj.id === state.selectedId; });
    if (index <= 0) return;
    pushHistory();
    const temp = state.objects[index];
    state.objects[index] = state.objects[index - 1];
    state.objects[index - 1] = temp;
  }

  function toggleVisibility(id) {
    const obj = objectById(id);
    if (!obj) return;
    pushHistory();
    obj.visible = obj.visible === false ? true : false;
  }

  function toggleLock(id) {
    const obj = objectById(id);
    if (!obj) return;
    pushHistory();
    obj.locked = !obj.locked;
  }

  function getNodeUsage(nodeId) {
    const usage = [];
    state.objects.forEach(function (obj) {
      if (!obj.points) return;
      obj.points.forEach(function (point, index) {
        if (point.nodeId === nodeId) usage.push({ objectId: obj.id, index: index, type: obj.type });
      });
    });
    return usage;
  }

  function connectedCount(nodeId) {
    return getNodeUsage(nodeId).length;
  }

  function setNodePosition(nodeId, x, y) {
    const node = nodeById(nodeId);
    if (!node) return;
    node.x = x;
    node.y = y;
    state.objects.forEach(function (obj) {
      if (!obj.points) return;
      obj.points.forEach(function (p) {
        if (p.nodeId === nodeId) {
          p.x = x;
          p.y = y;
        }
      });
    });
  }

  function mergeNodes(sourceNodeId, targetNodeId) {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return false;
    const source = nodeById(sourceNodeId);
    const target = nodeById(targetNodeId);
    if (!source || !target) return false;

    state.objects.forEach(function (obj) {
      if (!obj.points) return;
      obj.points.forEach(function (p) {
        if (p.nodeId === sourceNodeId) {
          p.nodeId = targetNodeId;
          p.x = target.x;
          p.y = target.y;
        }
      });
    });

    state.nodes = state.nodes.filter(function (n) { return n.id !== sourceNodeId; });
    return true;
  }

  function insertNodeIntoObject(objectId, segmentIndex, x, y, existingNodeId) {
    const obj = objectById(objectId);
    if (!obj || !obj.points || segmentIndex < 0 || segmentIndex >= obj.points.length - 1) return null;

    const node = existingNodeId ? nodeById(existingNodeId) : createNode(x, y);
    const point = makePoint(node.x, node.y, node.id);
    obj.points.splice(segmentIndex + 1, 0, point);
    return point;
  }

  function removeSelectedPoint() {
    const selected = state.selectedPoint;
    if (!selected) return false;
    const obj = objectById(selected.objectId);
    if (!obj || !obj.points) return false;

    const minimum = obj.type === 'area' ? 3 : 2;
    if (obj.points.length <= minimum) return false;

    pushHistory();
    obj.points.splice(selected.index, 1);
    state.selectedPoint = null;
    cleanupUnusedNodes();
    return true;
  }

  function splitSelectedRoad() {
    const selected = state.selectedPoint;
    const obj = selected ? objectById(selected.objectId) : null;
    if (!obj || obj.type !== 'road' || !obj.points) return false;
    const index = selected.index;
    if (index <= 0 || index >= obj.points.length - 1) return false;

    pushHistory();
    const first = utils.clone(obj);
    const second = utils.clone(obj);
    first.id = utils.uid('obj');
    second.id = utils.uid('obj');
    first.points = obj.points.slice(0, index + 1).map(utils.clone);
    second.points = obj.points.slice(index).map(utils.clone);

    const objectIndex = state.objects.findIndex(function (o) { return o.id === obj.id; });
    state.objects.splice(objectIndex, 1, first, second);
    state.selectedId = second.id;
    state.selectedPoint = { objectId: second.id, index: 0 };
    cleanupUnusedNodes();
    return true;
  }

  function moveObject(obj, dx, dy) {
    if (!obj || obj.locked) return;

    if (obj.points) {
      const moved = new Set();
      obj.points.forEach(function (p) {
        if (p.nodeId) {
          if (moved.has(p.nodeId)) return;
          moved.add(p.nodeId);
          const pos = pointPosition(p);
          setNodePosition(p.nodeId, pos.x + dx, pos.y + dy);
        } else {
          p.x += dx;
          p.y += dy;
        }
      });
    } else {
      obj.x = (obj.x || 0) + dx;
      obj.y = (obj.y || 0) + dy;
    }
  }

  function cleanupUnusedNodes() {
    const used = new Set();
    state.objects.forEach(function (obj) {
      if (!obj.points) return;
      obj.points.forEach(function (p) { if (p.nodeId) used.add(p.nodeId); });
    });
    state.nodes = state.nodes.filter(function (node) { return used.has(node.id); });
  }

  function currentProject() {
    return {
      version: 5,
      projectName: state.projectName || 'mapa-territorio',
      imageData: state.imageData,
      objects: state.objects,
      nodes: state.nodes,
      settings: state.settings,
      savedAt: new Date().toISOString()
    };
  }

  function loadProject(project) {
    state.projectName = project.projectName || '';
    state.imageData = project.imageData || null;
    state.nodes = project.nodes || [];
    state.objects = (project.objects || []).map(normalizeObject);
    state.settings = normalizeSettings(project.settings);
    state.selectedId = null;
    state.selectedPoint = null;
    state.drawingRoad = [];
    state.drawingArea = [];
    state.drawingFocus = null;
    state.snapPreview = null;
    state.connectDraft = null;
    state.historyPast = [];
    state.historyFuture = [];
    cleanupUnusedNodes();
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
    objectById,
    nodeById,
    selectObject,
    selectPoint,
    pointPosition,
    objectPoints,
    setPointPosition,
    createNode,
    makePoint,
    ensureNodeForPoint,
    ensureNodesForObject,
    addObject,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    toggleVisibility,
    toggleLock,
    getNodeUsage,
    connectedCount,
    setNodePosition,
    mergeNodes,
    insertNodeIntoObject,
    removeSelectedPoint,
    splitSelectedRoad,
    moveObject,
    defaultStyle,
    rememberStyle,
    cleanupUnusedNodes,
    currentProject,
    loadProject
  };
})();
