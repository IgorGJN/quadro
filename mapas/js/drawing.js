(function () {
  'use strict';

  const T = window.Territorios || (window.Territorios = {});
  const utils = T.utils;

  let canvas = null;
  let ctx = null;
  let wrap = null;

  function setup(canvasEl, wrapEl) {
    canvas = canvasEl;
    wrap = wrapEl;
    ctx = canvas.getContext('2d');
  }

  function resizeCanvas() {
    if (!canvas || !wrap) return;

    const stage = document.getElementById('mapStage');
    const panel = document.getElementById('canvasPanel');
    if (stage && panel) {
      const panelRect = panel.getBoundingClientRect();
      const padding = window.innerWidth <= 980 ? 16 : 28;
      const ratio = 14 / 5.8;
      let maxW = Math.max(260, panelRect.width - padding);
      let maxH = Math.max(160, panelRect.height - padding);
      let width = maxW;
      let height = width / ratio;

      if (height > maxH) {
        height = maxH;
        width = height * ratio;
      }

      stage.style.width = Math.floor(width) + 'px';
      stage.style.height = Math.floor(height) + 'px';
    }

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function fitImage() {
    const state = T.state;
    if (!state.image || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const sx = rect.width / state.image.width;
    const sy = rect.height / state.image.height;
    state.scale = Math.min(sx, sy) * 0.95;
    state.offsetX = (rect.width - state.image.width * state.scale) / 2;
    state.offsetY = (rect.height - state.image.height * state.scale) / 2;
  }

  function screenToWorld(x, y) {
    const state = T.state;
    return { x: (x - state.offsetX) / state.scale, y: (y - state.offsetY) / state.scale };
  }

  function worldToScreen(x, y) {
    const state = T.state;
    return { x: x * state.scale + state.offsetX, y: y * state.scale + state.offsetY };
  }

  function draw() {
    if (!ctx || !wrap) return;
    const state = T.state;
    const rect = wrap.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(state.offsetX, state.offsetY);
    ctx.scale(state.scale, state.scale);

    if (state.image && state.settings.mapVisible !== false) ctx.drawImage(state.image, 0, 0);

    drawSceneObjects(ctx, true);

    drawDrafts(ctx);
    drawNodeOverlay(ctx);
    ctx.restore();

    drawSnapPreview();
  }

  function drawDrafts(c) {
    const state = T.state;
    if (state.drawingRoad.length) {
      c.save();
      c.strokeStyle = '#2563eb';
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.setLineDash([8, 6]);
      drawPolyline(c, state.drawingRoad.map(T.store.pointPosition), false);
      c.setLineDash([]);
      drawControlPoints(c, state.drawingRoad.map(T.store.pointPosition), '#2563eb');
      c.restore();
    }

    if (state.drawingArea.length) {
      c.save();
      c.fillStyle = utils.hexToRgba('#2563eb', 0.12);
      c.strokeStyle = '#2563eb';
      c.lineWidth = 3;
      c.setLineDash([8, 6]);
      drawPolygon(c, state.drawingArea.map(T.store.pointPosition), false, false);
      c.setLineDash([]);
      drawControlPoints(c, state.drawingArea.map(T.store.pointPosition), '#2563eb');
      c.restore();
    }

    if (state.drawingFocus) drawFocus(c, state.drawingFocus, true);
  }

  function drawSnapPreview() {
    const state = T.state;
    if (!state.snapPreview || !ctx) return;

    const p = worldToScreen(state.snapPreview.x, state.snapPreview.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, state.snapPreview.type === 'segment' ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = state.snapPreview.type === 'segment' ? 'rgba(22,163,74,.18)' : 'rgba(37,99,235,.18)';
    ctx.fill();
    ctx.strokeStyle = state.snapPreview.type === 'segment' ? '#16a34a' : '#2563eb';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawSceneObjects(c, showSelection) {
    const state = T.state;
    const visibleObjects = state.objects.filter(function (obj) { return obj.visible !== false; });
    const areas = visibleObjects.filter(function (obj) { return obj.type === 'area'; });
    const roads = visibleObjects.filter(function (obj) { return obj.type === 'road'; });
    const overlays = visibleObjects.filter(function (obj) { return obj.type !== 'area' && obj.type !== 'road'; });

    areas.forEach(function (obj) { drawObject(c, obj, showSelection); });
    drawRoadSystem(c, roads);
    overlays.forEach(function (obj) { drawObject(c, obj, showSelection); });

    if (showSelection) {
      const selected = T.store.selectedObject();
      if (selected && selected.visible !== false && selected.type === 'road') drawSelection(c, selected);
    }
  }

  function drawRoadSystem(c, roads) {
    const validRoads = roads.filter(function (obj) { return T.store.objectPoints(obj).length >= 2; });
    if (!validRoads.length) return;

    c.save();
    validRoads.forEach(function (obj) { drawRoadStroke(c, obj, 'border'); });
    drawRoadJunctionCaps(c, validRoads, 'border');
    validRoads.forEach(function (obj) { drawRoadStroke(c, obj, 'fill'); });
    drawRoadJunctionCaps(c, validRoads, 'fill');
    c.restore();
  }

  function drawRoadStroke(c, obj, phase) {
    const points = T.store.objectPoints(obj);
    if (points.length < 2) return;

    c.save();
    c.lineJoin = obj.rounded === false ? 'miter' : 'round';
    c.lineCap = obj.rounded === false ? 'butt' : 'round';

    if (phase === 'border') {
      if ((obj.borderWidth || 0) <= 0) { c.restore(); return; }
      c.strokeStyle = obj.borderColor || '#ffffff';
      c.lineWidth = (obj.size || 8) + (obj.borderWidth || 0) * 2;
      drawPolyline(c, points, !!obj.smooth);
      c.restore();
      return;
    }

    c.strokeStyle = obj.color || '#2563eb';
    c.lineWidth = obj.size || 8;
    drawPolyline(c, points, !!obj.smooth);
    c.restore();
  }

  function drawRoadJunctionCaps(c, roads, phase) {
    const usagesByNode = new Map();

    roads.forEach(function (road, roadOrder) {
      if (!road.points) return;
      road.points.forEach(function (point) {
        if (!point.nodeId) return;
        const node = T.store.nodeById(point.nodeId);
        if (!node) return;
        if (!usagesByNode.has(point.nodeId)) usagesByNode.set(point.nodeId, []);
        usagesByNode.get(point.nodeId).push({ road: road, node: node, order: roadOrder });
      });
    });

    usagesByNode.forEach(function (usages) {
      if (usages.length < 2) return;
      const node = usages[0].node;

      if (phase === 'border') {
        const withBorder = usages.filter(function (usage) { return (usage.road.borderWidth || 0) > 0; });
        if (!withBorder.length) return;
        const radius = Math.max.apply(null, withBorder.map(function (usage) {
          return ((usage.road.size || 8) + (usage.road.borderWidth || 0) * 2) / 2;
        }));
        const top = withBorder[withBorder.length - 1].road;
        c.save();
        c.beginPath();
        c.arc(node.x, node.y, radius, 0, Math.PI * 2);
        c.fillStyle = top.borderColor || '#ffffff';
        c.fill();
        c.restore();
        return;
      }

      const colors = Array.from(new Set(usages.map(function (usage) { return usage.road.color || '#2563eb'; })));
      if (colors.length !== 1) return;
      const radius = Math.max.apply(null, usages.map(function (usage) { return (usage.road.size || 8) / 2; }));
      c.save();
      c.beginPath();
      c.arc(node.x, node.y, radius, 0, Math.PI * 2);
      c.fillStyle = colors[0];
      c.fill();
      c.restore();
    });
  }

  function drawObject(c, obj, showSelection) {
    c.save();
    if (obj.type === 'road') drawRoad(c, obj);
    if (obj.type === 'text') drawTextObject(c, obj);
    if (obj.type === 'point') drawPoint(c, obj);
    if (obj.type === 'compass') drawCompass(c, obj);
    if (obj.type === 'legend') drawLegend(c, obj);
    if (obj.type === 'focus') drawFocus(c, obj, false);
    if (obj.type === 'area') drawArea(c, obj);
    if (showSelection && obj.id === T.state.selectedId) drawSelection(c, obj);
    c.restore();
  }

  function drawRoad(c, obj) {
    // Mantido para compatibilidade quando uma rua é desenhada isoladamente.
    drawRoadStroke(c, obj, 'border');
    drawRoadStroke(c, obj, 'fill');
  }

  function drawArea(c, obj) {
    const points = T.store.objectPoints(obj);
    if (points.length < 2) return;
    c.save();
    c.fillStyle = utils.hexToRgba(obj.color || '#facc15', obj.opacity ?? 0.25);
    c.strokeStyle = obj.borderColor || obj.color || '#111827';
    c.lineWidth = obj.borderWidth || 3;
    drawPolygon(c, points, !!obj.smooth, true);
    if (obj.name) {
      const center = polygonCenter(points);
      drawMultilineText(c, obj.name, center.x, center.y, obj.borderColor || '#111827', obj.size || 16, 'center', '#ffffff', 4, obj.rotation || 0);
    }
    c.restore();
  }

  function drawTextObject(c, obj) {
    drawMultilineText(c, obj.name || 'Texto', obj.x || 0, obj.y || 0, obj.color || '#111827', obj.size || 18, 'center', obj.borderColor || '#ffffff', obj.borderWidth || 4, obj.rotation || 0);
  }

  function drawPoint(c, obj) {
    c.save();
    c.translate(obj.x || 0, obj.y || 0);
    c.rotate((Number(obj.rotation) || 0) * Math.PI / 180);
    if ((obj.borderWidth || 0) > 0) {
      c.fillStyle = obj.borderColor || '#ffffff';
      c.font = ((obj.size || 24) + (obj.borderWidth || 0)) + 'px Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(obj.icon || '●', 0, 0);
    }
    c.fillStyle = obj.color || '#dc2626';
    c.font = (obj.size || 24) + 'px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(obj.icon || '●', 0, 0);
    c.restore();
    if (obj.name) drawMultilineText(c, obj.name, (obj.x || 0) + 16, (obj.y || 0) + 5, '#111827', 14, 'left', '#ffffff', 4, obj.rotation || 0);
  }

  function drawCompass(c, obj) {
    const s = obj.size || 60;
    c.save();
    c.translate(obj.x || 0, obj.y || 0);
    c.rotate((Number(obj.rotation) || 0) * Math.PI / 180);
    c.strokeStyle = obj.color || '#111827';
    c.fillStyle = obj.color || '#111827';
    c.lineWidth = Math.max(2, obj.borderWidth || 3);
    c.beginPath();
    c.moveTo(0, -s / 2);
    c.lineTo(-s / 6, s / 4);
    c.lineTo(0, s / 8);
    c.lineTo(s / 6, s / 4);
    c.closePath();
    c.stroke();
    drawText(c, 'N', 0, -s / 2 - 12, obj.color || '#111827', 18, 'center', '#ffffff', 4);
    c.restore();
  }

  function drawLegend(c, obj) {
    const lines = String(obj.name || 'Legenda\n● Ponto de referência\n— Rua').split('\n');
    const pad = 10;
    const lineH = obj.size || 16;
    c.save();
    c.font = 'bold ' + lineH + 'px Arial';
    const width = Math.max.apply(null, lines.map(function (line) { return c.measureText(line || ' ').width; })) + pad * 2 + 32;
    const height = lines.length * (lineH + 7) + pad * 2;
    const x = obj.x || 0;
    const y = obj.y || 0;
    c.fillStyle = utils.hexToRgba(obj.backgroundColor || '#ffffff', 1 - (obj.opacity ?? 0.1));
    c.strokeStyle = obj.borderColor || '#111827';
    c.lineWidth = obj.borderWidth ?? 2;
    c.fillRect(x, y, width, height);
    if ((obj.borderWidth ?? 2) > 0) c.strokeRect(x, y, width, height);
    lines.forEach(function (line, i) {
      drawText(c, line, x + pad, y + pad + 12 + i * (lineH + 7), obj.color || '#111827', lineH, 'left', '#ffffff', 0);
    });
    c.restore();
  }

  function drawFocus(c, obj, isDraft) {
    const x = Math.min(obj.x || 0, (obj.x || 0) + (obj.w || 0));
    const y = Math.min(obj.y || 0, (obj.y || 0) + (obj.h || 0));
    const w = Math.abs(obj.w || 0);
    const h = Math.abs(obj.h || 0);
    const fullW = T.state.image ? T.state.image.width : Math.max(3000, x + w + 1000);
    const fullH = T.state.image ? T.state.image.height : Math.max(3000, y + h + 1000);
    const shape = obj.shape || 'rect';

    c.save();
    c.fillStyle = utils.hexToRgba(obj.color || '#ffffff', obj.opacity ?? 0.55);

    if (shape === 'circle' || shape === 'ellipse') {
      c.beginPath();
      c.rect(0, 0, fullW, fullH);
      c.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2, true);
      c.fill('evenodd');
      c.strokeStyle = obj.borderColor || '#111827';
      c.lineWidth = obj.borderWidth || 4;
      if (isDraft) c.setLineDash([10, 8]);
      c.beginPath();
      c.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
      c.stroke();
    } else {
      c.fillRect(0, 0, fullW, y);
      c.fillRect(0, y + h, fullW, Math.max(0, fullH - y - h));
      c.fillRect(0, y, x, h);
      c.fillRect(x + w, y, Math.max(0, fullW - x - w), h);
      c.strokeStyle = obj.borderColor || '#111827';
      c.lineWidth = obj.borderWidth || 4;
      if (isDraft) c.setLineDash([10, 8]);
      if ((obj.borderWidth ?? 4) > 0) c.strokeRect(x, y, w, h);
    }

    if (obj.name) drawMultilineText(c, obj.name, x + w / 2, y - 14, obj.borderColor || '#111827', obj.size || 16, 'center', '#ffffff', 4, obj.rotation || 0);
    c.restore();
  }

  function drawPolyline(c, points, smooth) {
    if (!points || points.length < 2) return;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    if (!smooth || points.length < 3) {
      for (let i = 1; i < points.length; i += 1) c.lineTo(points[i].x, points[i].y);
    } else {
      for (let i = 1; i < points.length - 1; i += 1) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        c.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
      const last = points[points.length - 1];
      c.lineTo(last.x, last.y);
    }
    c.stroke();
  }

  function drawPolygon(c, points, smooth, closed) {
    if (!points || points.length < 2) return;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    if (!smooth || points.length < 3) {
      for (let i = 1; i < points.length; i += 1) c.lineTo(points[i].x, points[i].y);
    } else {
      for (let i = 1; i < points.length; i += 1) {
        const next = points[(i + 1) % points.length];
        const midX = (points[i].x + next.x) / 2;
        const midY = (points[i].y + next.y) / 2;
        c.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
      }
    }
    if (closed && points.length > 2) {
      c.closePath();
      c.fill();
      c.stroke();
    } else {
      c.stroke();
    }
  }

  function drawText(c, text, x, y, color, size, align, strokeColor, strokeWidth) {
    c.save();
    c.font = 'bold ' + (size || 16) + 'px Arial';
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    if ((strokeWidth || 0) > 0) {
      c.lineWidth = strokeWidth;
      c.strokeStyle = strokeColor || '#ffffff';
      c.strokeText(text, x, y);
    }
    c.fillStyle = color || '#111827';
    c.fillText(text, x, y);
    c.restore();
  }

  function drawMultilineText(c, text, x, y, color, size, align, strokeColor, strokeWidth, rotation) {
    const lines = String(text || '').split('\n');
    const lineHeight = (size || 16) * 1.25;
    c.save();
    c.translate(x, y);
    c.rotate((Number(rotation) || 0) * Math.PI / 180);
    lines.forEach(function (line, i) {
      drawText(c, line, 0, (i - (lines.length - 1) / 2) * lineHeight, color, size, align, strokeColor, strokeWidth);
    });
    c.restore();
  }

  function drawControlPoints(c, points, color) {
    c.save();
    c.fillStyle = '#ffffff';
    c.strokeStyle = color || '#2563eb';
    c.lineWidth = 2 / T.state.scale;
    points.forEach(function (p) {
      c.beginPath();
      c.arc(p.x, p.y, 5 / T.state.scale, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });
    c.restore();
  }

  function drawNodeOverlay(c) {
    const state = T.state;
    const selected = T.store.selectedObject();
    const shouldShow = state.settings.showNodes && ['road', 'area', 'edit', 'connect'].includes(state.tool);
    const shouldShowSelected = selected && selected.points;
    if (!shouldShow && !shouldShowSelected) return;

    c.save();
    state.nodes.forEach(function (node) {
      const usage = T.store.connectedCount(node.id);
      if (usage === 0) return;
      if (!shouldShow && shouldShowSelected) {
        const found = selected.points.some(function (p) { return p.nodeId === node.id; });
        if (!found) return;
      }
      const r = Math.max(4, usage > 1 ? 7 : 5) / T.state.scale;
      c.beginPath();
      c.arc(node.x, node.y, r, 0, Math.PI * 2);
      c.fillStyle = usage > 1 ? '#16a34a' : '#ffffff';
      c.strokeStyle = usage > 1 ? '#166534' : '#2563eb';
      c.lineWidth = 2 / T.state.scale;
      c.fill();
      c.stroke();
      if (state.settings.nodeLabels && usage > 1) {
        drawText(c, String(usage), node.x, node.y - 14 / T.state.scale, '#166534', 11 / T.state.scale, 'center', '#ffffff', 3 / T.state.scale);
      }
    });

    if (state.connectDraft) {
      const node = T.store.nodeById(state.connectDraft.nodeId);
      if (node) {
        c.beginPath();
        c.arc(node.x, node.y, 12 / T.state.scale, 0, Math.PI * 2);
        c.strokeStyle = '#dc2626';
        c.lineWidth = 3 / T.state.scale;
        c.stroke();
      }
    }
    c.restore();
  }

  function drawSelection(c, obj) {
    const box = getObjectBox(obj);
    c.save();
    c.strokeStyle = '#2563eb';
    c.lineWidth = 2 / T.state.scale;
    c.setLineDash([6 / T.state.scale, 4 / T.state.scale]);
    c.strokeRect(box.x, box.y, box.w, box.h);
    c.restore();

    if (obj.points) {
      drawControlPoints(c, T.store.objectPoints(obj), '#2563eb');
      if (T.state.selectedPoint && T.state.selectedPoint.objectId === obj.id) {
        const p = T.store.pointPosition(obj.points[T.state.selectedPoint.index]);
        c.save();
        c.beginPath();
        c.arc(p.x, p.y, 10 / T.state.scale, 0, Math.PI * 2);
        c.strokeStyle = '#dc2626';
        c.lineWidth = 3 / T.state.scale;
        c.stroke();
        c.restore();
      }
    }
  }

  function getObjectBox(obj) {
    if (obj.points && obj.points.length) {
      const points = T.store.objectPoints(obj);
      const xs = points.map(function (p) { return p.x; });
      const ys = points.map(function (p) { return p.y; });
      return { x: Math.min.apply(null, xs) - 16, y: Math.min.apply(null, ys) - 16, w: Math.max.apply(null, xs) - Math.min.apply(null, xs) + 32, h: Math.max.apply(null, ys) - Math.min.apply(null, ys) + 32 };
    }
    if (obj.type === 'focus') {
      const x = Math.min(obj.x || 0, (obj.x || 0) + (obj.w || 0));
      const y = Math.min(obj.y || 0, (obj.y || 0) + (obj.h || 0));
      return { x: x, y: y, w: Math.abs(obj.w || 0), h: Math.abs(obj.h || 0) };
    }
    if (obj.type === 'legend') return { x: obj.x || 0, y: obj.y || 0, w: 260, h: 170 };
    const s = Math.max(24, obj.size || 30);
    return { x: (obj.x || 0) - s, y: (obj.y || 0) - s, w: s * 2, h: s * 2 };
  }

  function hitTest(x, y) {
    const objects = T.state.objects;
    for (let i = objects.length - 1; i >= 0; i -= 1) {
      const obj = objects[i];
      if (obj.visible === false) continue;
      const box = getObjectBox(obj);
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return obj;
    }
    return null;
  }

  function hitNode(x, y, options) {
    const maxDistance = ((options && options.distance) || T.state.settings.snapDistance || 22) / Math.max(T.state.scale, 0.01);
    let best = null;
    let bestDistance = Infinity;
    T.state.nodes.forEach(function (node) {
      const d = utils.distance({ x: x, y: y }, node);
      if (d <= maxDistance && d < bestDistance) {
        best = node;
        bestDistance = d;
      }
    });
    return best;
  }

  function hitObjectPoint(x, y, objectId) {
    const maxDistance = (T.state.settings.snapDistance || 22) / Math.max(T.state.scale, 0.01);
    const objects = objectId ? [T.store.objectById(objectId)].filter(Boolean) : T.state.objects;
    let best = null;
    let bestDistance = Infinity;
    objects.forEach(function (obj) {
      if (!obj.points || obj.visible === false || obj.locked) return;
      obj.points.forEach(function (point, index) {
        const pos = T.store.pointPosition(point);
        const d = utils.distance({ x: x, y: y }, pos);
        if (d <= maxDistance && d < bestDistance) {
          bestDistance = d;
          best = { object: obj, point: point, index: index, nodeId: point.nodeId, x: pos.x, y: pos.y };
        }
      });
    });
    return best;
  }

  function hitSegment(x, y, options) {
    const maxDistance = ((options && options.distance) || T.state.settings.snapDistance || 22) / Math.max(T.state.scale, 0.01);
    let best = null;
    let bestDistance = Infinity;
    T.state.objects.forEach(function (obj) {
      if (!obj.points || obj.visible === false || obj.locked || (obj.type !== 'road' && obj.type !== 'area')) return;
      const points = T.store.objectPoints(obj);
      const last = obj.type === 'area' ? points.length : points.length - 1;
      for (let i = 0; i < last; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const projection = utils.projectPointOnSegment({ x: x, y: y }, a, b);
        if (projection.t > 0.05 && projection.t < 0.95 && projection.distance <= maxDistance && projection.distance < bestDistance) {
          bestDistance = projection.distance;
          best = { object: obj, segmentIndex: i, x: projection.x, y: projection.y, t: projection.t, type: 'segment' };
        }
      }
    });
    return best;
  }

  function findSnapTarget(point) {
    const state = T.state;
    state.snapPreview = null;
    if (!state.settings.snapEnabled) return null;

    const node = hitNode(point.x, point.y);
    if (node) {
      state.snapPreview = { type: 'node', x: node.x, y: node.y, nodeId: node.id };
      return { type: 'node', node: node, x: node.x, y: node.y };
    }

    const segment = hitSegment(point.x, point.y);
    if (segment) {
      state.snapPreview = { type: 'segment', x: segment.x, y: segment.y, objectId: segment.object.id, segmentIndex: segment.segmentIndex };
      return segment;
    }

    return null;
  }

  function snapPointPreview(point) {
    findSnapTarget(point);
    return T.state.snapPreview || null;
  }

  function makeSnappedPoint(point) {
    const target = findSnapTarget(point);
    if (!target) return T.store.makePoint(point.x, point.y, null);

    if (target.type === 'node') {
      return T.store.makePoint(target.x, target.y, target.node.id);
    }

    if (target.type === 'segment') {
      T.store.pushHistory();
      const inserted = T.store.insertNodeIntoObject(target.object.id, target.segmentIndex, target.x, target.y);
      return T.store.makePoint(target.x, target.y, inserted.nodeId);
    }

    return T.store.makePoint(point.x, point.y, null);
  }

  function createRealIntersections() {
    const roads = T.state.objects.filter(function (obj) { return obj.type === 'road' && obj.points && obj.visible !== false; });
    let count = 0;
    if (roads.length < 2) return 0;
    T.store.pushHistory();

    for (let i = 0; i < roads.length; i += 1) {
      for (let j = i + 1; j < roads.length; j += 1) {
        let changed = true;
        while (changed) {
          changed = false;
          const aPoints = T.store.objectPoints(roads[i]);
          const bPoints = T.store.objectPoints(roads[j]);
          outer: for (let ai = 0; ai < aPoints.length - 1; ai += 1) {
            for (let bi = 0; bi < bPoints.length - 1; bi += 1) {
              const hit = utils.segmentIntersection(aPoints[ai], aPoints[ai + 1], bPoints[bi], bPoints[bi + 1]);
              if (!hit) continue;
              const node = T.store.createNode(hit.x, hit.y);
              T.store.insertNodeIntoObject(roads[i].id, ai, hit.x, hit.y, node.id);
              T.store.insertNodeIntoObject(roads[j].id, bi, hit.x, hit.y, node.id);
              count += 1;
              changed = true;
              break outer;
            }
          }
        }
      }
    }

    if (count === 0) T.state.historyPast.pop();
    T.store.cleanupUnusedNodes();
    return count;
  }

  function polygonCenter(points) {
    if (!points || !points.length) return { x: 0, y: 0 };
    const sum = points.reduce(function (acc, p) { acc.x += p.x; acc.y += p.y; return acc; }, { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  T.drawing = {
    setup,
    resizeCanvas,
    fitImage,
    screenToWorld,
    worldToScreen,
    draw,
    drawSceneObjects,
    drawObject,
    getObjectBox,
    hitTest,
    hitNode,
    hitObjectPoint,
    hitSegment,
    findSnapTarget,
    snapPointPreview,
    makeSnappedPoint,
    createRealIntersections,
    drawMultilineText
  };
})();
