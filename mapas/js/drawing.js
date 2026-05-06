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

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

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
    return {
      x: (x - state.offsetX) / state.scale,
      y: (y - state.offsetY) / state.scale
    };
  }

  function worldToScreen(x, y) {
    const state = T.state;
    return {
      x: x * state.scale + state.offsetX,
      y: y * state.scale + state.offsetY
    };
  }

  function draw() {
    if (!ctx || !wrap) return;

    const state = T.state;
    const rect = wrap.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(state.offsetX, state.offsetY);
    ctx.scale(state.scale, state.scale);

    if (state.image) {
      ctx.drawImage(state.image, 0, 0);
    } else {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    state.objects.forEach(function (obj) {
      drawObject(ctx, obj, true);
    });

    drawDrafts(ctx);

    ctx.restore();

    drawSnapPreview();
  }

  function drawDrafts(c) {
    const state = T.state;

    if (state.drawingRoad.length) {
      c.save();
      c.strokeStyle = '#2563eb';
      c.lineWidth = 4;
      c.setLineDash([8, 6]);
      drawPolyline(c, state.drawingRoad, false);
      c.setLineDash([]);
      drawControlPoints(c, state.drawingRoad);
      c.restore();
    }

    if (state.drawingArea.length) {
      c.save();
      c.fillStyle = utils.hexToRgba('#2563eb', 0.12);
      c.strokeStyle = '#2563eb';
      c.lineWidth = 3;
      c.setLineDash([8, 6]);
      drawPolygon(c, state.drawingArea, false, false);
      c.setLineDash([]);
      drawControlPoints(c, state.drawingArea);
      c.restore();
    }

    if (state.drawingFocus) {
      drawFocus(c, state.drawingFocus, true);
    }
  }

  function drawSnapPreview() {
    const state = T.state;
    if (!state.snapPreview || !ctx) return;

    const p = worldToScreen(state.snapPreview.x, state.snapPreview.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(37,99,235,.18)';
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
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

    if (showSelection && obj.id === T.state.selectedId) {
      drawSelection(c, obj);
    }

    c.restore();
  }

  function drawRoad(c, obj) {
    c.save();
    c.lineJoin = obj.rounded === false ? 'miter' : 'round';
    c.lineCap = obj.rounded === false ? 'butt' : 'round';

    if ((obj.borderWidth || 0) > 0) {
      c.strokeStyle = obj.borderColor || '#ffffff';
      c.lineWidth = (obj.size || 6) + (obj.borderWidth || 0) * 2;
      drawPolyline(c, obj.points || [], !!obj.smooth);
    }

    c.strokeStyle = obj.color || '#2563eb';
    c.lineWidth = obj.size || 6;
    drawPolyline(c, obj.points || [], !!obj.smooth);
    c.restore();
  }

  function drawArea(c, obj) {
    const points = obj.points || [];
    if (points.length < 2) return;

    c.save();
    c.fillStyle = utils.hexToRgba(obj.color || '#facc15', obj.opacity ?? 0.25);
    c.strokeStyle = obj.borderColor || obj.color || '#111827';
    c.lineWidth = obj.borderWidth || 3;

    drawPolygon(c, points, obj.smooth, true);

    if (obj.name) {
      const center = polygonCenter(points);
      drawMultilineText(c, obj.name, center.x, center.y, obj.borderColor || '#111827', obj.size || 16, 'center', '#ffffff', 4, obj.rotation || 0);
    }

    c.restore();
  }

  function drawTextObject(c, obj) {
    drawMultilineText(
      c,
      obj.name || 'Texto',
      obj.x || 0,
      obj.y || 0,
      obj.color || '#111827',
      obj.size || 18,
      'center',
      obj.borderColor || '#ffffff',
      obj.borderWidth ?? 4,
      obj.rotation || 0
    );
  }

  function drawPoint(c, obj) {
    c.save();

    c.translate(obj.x || 0, obj.y || 0);
    c.rotate((Number(obj.rotation) || 0) * Math.PI / 180);

    if ((obj.borderWidth || 0) > 0) {
      c.fillStyle = obj.borderColor || '#ffffff';
      c.font = `${(obj.size || 24) + (obj.borderWidth || 0)}px Arial`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(obj.icon || '●', 0, 0);
    }

    c.fillStyle = obj.color || '#dc2626';
    c.font = `${obj.size || 24}px Arial`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(obj.icon || '●', 0, 0);

    c.restore();

    if (obj.name) {
      drawMultilineText(c, obj.name, (obj.x || 0) + 16, (obj.y || 0) + 4, '#111827', 14, 'left', '#ffffff', 4, 0);
    }
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

    drawMultilineText(c, 'N', 0, -s / 2 - 14, obj.color || '#111827', Math.max(16, s * 0.28), 'center', '#ffffff', 4, 0);

    c.restore();
  }

  function drawLegend(c, obj) {
    const lines = String(obj.name || 'Legenda\n● Ponto de referência\n— Rua').split('\n');
    const pad = 10;
    const lineH = obj.size || 16;

    c.save();
    c.font = `bold ${lineH}px Arial`;
    const width = Math.max.apply(null, lines.map(function (line) {
      return c.measureText(line || ' ').width;
    })) + pad * 2 + 30;
    const height = lines.length * (lineH + 7) + pad * 2;

    c.fillStyle = utils.hexToRgba(obj.backgroundColor || '#ffffff', 1 - (obj.opacity ?? 0.1));
    c.strokeStyle = obj.borderColor || obj.color || '#111827';
    c.lineWidth = obj.borderWidth ?? 2;

    c.fillRect(obj.x || 0, obj.y || 0, width, height);
    if ((obj.borderWidth ?? 2) > 0) {
      c.strokeRect(obj.x || 0, obj.y || 0, width, height);
    }

    lines.forEach(function (line, i) {
      drawText(c, line, (obj.x || 0) + pad, (obj.y || 0) + pad + 12 + i * (lineH + 7), obj.color || '#111827', lineH, 'left', '#ffffff', 0);
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

    c.save();

    c.fillStyle = utils.hexToRgba(obj.color || '#ffffff', obj.opacity ?? 0.55);

    c.fillRect(0, 0, fullW, y);
    c.fillRect(0, y + h, fullW, Math.max(0, fullH - y - h));
    c.fillRect(0, y, x, h);
    c.fillRect(x + w, y, Math.max(0, fullW - x - w), h);

    c.strokeStyle = obj.borderColor || '#111827';
    c.lineWidth = obj.borderWidth || 4;
    if (isDraft) c.setLineDash([10, 8]);
    if ((obj.borderWidth ?? 4) > 0) {
      c.strokeRect(x, y, w, h);
    }

    if (obj.name) {
      drawMultilineText(c, obj.name, x + w / 2, y - 14, obj.borderColor || '#111827', obj.size || 16, 'center', '#ffffff', 4, obj.rotation || 0);
    }

    c.restore();
  }

  function drawPolyline(c, points, smooth) {
    if (!points || points.length < 2) return;

    c.beginPath();
    c.moveTo(points[0].x, points[0].y);

    if (!smooth || points.length < 3) {
      for (let i = 1; i < points.length; i += 1) {
        c.lineTo(points[i].x, points[i].y);
      }
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
      for (let i = 1; i < points.length; i += 1) {
        c.lineTo(points[i].x, points[i].y);
      }
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
    c.font = `bold ${size}px Arial`;
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

  function drawControlPoints(c, points) {
    c.save();
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#2563eb';
    c.lineWidth = 2 / T.state.scale;

    points.forEach(function (p) {
      c.beginPath();
      c.arc(p.x, p.y, 5 / T.state.scale, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    });

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
      drawControlPoints(c, obj.points);
    }
  }

  function getObjectBox(obj) {
    if (obj.points && obj.points.length) {
      const xs = obj.points.map(function (p) { return p.x; });
      const ys = obj.points.map(function (p) { return p.y; });
      return {
        x: Math.min.apply(null, xs) - 14,
        y: Math.min.apply(null, ys) - 14,
        w: Math.max.apply(null, xs) - Math.min.apply(null, xs) + 28,
        h: Math.max.apply(null, ys) - Math.min.apply(null, ys) + 28
      };
    }

    if (obj.type === 'focus') {
      const x = Math.min(obj.x || 0, (obj.x || 0) + (obj.w || 0));
      const y = Math.min(obj.y || 0, (obj.y || 0) + (obj.h || 0));
      return { x, y, w: Math.abs(obj.w || 0), h: Math.abs(obj.h || 0) };
    }

    if (obj.type === 'legend') {
      return { x: obj.x || 0, y: obj.y || 0, w: 240, h: 150 };
    }

    const s = Math.max(24, obj.size || 30);
    return {
      x: (obj.x || 0) - s,
      y: (obj.y || 0) - s,
      w: s * 2,
      h: s * 2
    };
  }

  function hitTest(x, y) {
    const objects = T.state.objects;

    for (let i = objects.length - 1; i >= 0; i -= 1) {
      const obj = objects[i];
      const box = getObjectBox(obj);

      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        return obj;
      }
    }

    return null;
  }

  function moveObject(obj, dx, dy) {
    if (!obj) return;

    if (obj.points) {
      obj.points.forEach(function (p) {
        p.x += dx;
        p.y += dy;
      });
    } else {
      obj.x = (obj.x || 0) + dx;
      obj.y = (obj.y || 0) + dy;
    }
  }

  function polygonCenter(points) {
    if (!points || !points.length) return { x: 0, y: 0 };

    const sum = points.reduce(function (acc, p) {
      acc.x += p.x;
      acc.y += p.y;
      return acc;
    }, { x: 0, y: 0 });

    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    };
  }

  function snapPoint(point) {
    const state = T.state;
    state.snapPreview = null;

    if (!state.settings.snapEnabled) return point;

    const maxDistance = (Number(state.settings.snapDistance) || 18) / Math.max(state.scale, 0.01);
    let best = null;
    let bestDistance = Infinity;

    state.objects.forEach(function (obj) {
      if (!obj.points || (obj.type !== 'road' && obj.type !== 'area')) return;

      obj.points.forEach(function (candidate) {
        const d = utils.distance(point, candidate);
        if (d < bestDistance && d <= maxDistance) {
          bestDistance = d;
          best = candidate;
        }
      });
    });

    if (best) {
      state.snapPreview = { x: best.x, y: best.y };
      return { x: best.x, y: best.y };
    }

    return point;
  }

  T.drawing = {
    setup,
    resizeCanvas,
    fitImage,
    screenToWorld,
    worldToScreen,
    draw,
    drawObject,
    getObjectBox,
    hitTest,
    moveObject,
    snapPoint
  };
})();
