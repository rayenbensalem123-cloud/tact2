// ---- Initialize ----
const canvas = document.getElementById('pitchCanvas');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvasWrap');

// iPad viewport height fix: 100dvh via CSS, recalculation on resize/orientation change
window.addEventListener('resize', () => { resizeCanvas(); });
window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 300); });

const pitch = new PitchRenderer();
const players = new PlayerManager();
const drawings = new DrawingEngine();
const equipment = new EquipmentManager();
const history = new HistoryManager();
const animation = new AnimationManager();

let currentTool = 'select';
let zoom = 1;
let panX = 0, panY = 0;
let isPanning = false;
let panStartX = 0, panStartY = 0;
let gridEnabled = false;
let snapEnabled = false;
let showLabels = true;
let isDirty = false;
let autoSaveTimer = null;
let searchTerm = '';
let isAnimating = false;

let canvasScale = 1;
let pitchOffsetX = 0, pitchOffsetY = 0;

// Clipboard
let clipboard = null;

// Rubber band selection
let rubberBand = null;

// Player-connected shapes (triangle, polygon)
let connections = [];
let selectedConnection = -1;

// Point placement state for triangle/connector tools
let connPlacement = null;

// Selected text drawing for font size control
let selectedTextIndex = -1;
let selectedDrawingIndex = -1;

// ---- Resize ----
function resizeCanvas() {
  const r = wrap.getBoundingClientRect();
  const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const isTablet = window.innerWidth <= 1024;
  const pad = isFS ? 0 : (isTablet ? 6 : 20);
  const statusH = isFS ? 0 : (isTablet ? 16 : 24);
  const maxW = r.width - pad * 2;
  const maxH = r.height - pad * 2 - statusH;
  const dim = pitch.getViewDimensions();
  const aspect = dim.w / dim.h;
  let w, h;
  if (isFS) { w = maxW; h = maxH; }
  else { if (maxW / maxH > aspect) { h = maxH; w = h * aspect; } else { w = maxW; h = w / aspect; } }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvasScale = (w / dim.w) * dpr * zoom;
  pitchOffsetX = panX;
  pitchOffsetY = panY;
  canvas.style.marginLeft = '0px';
  canvas.style.marginTop = '0px';
  render();
}
window.addEventListener('resize', resizeCanvas);

let cleanTitle = 'Untitled';

function markDirty() {
  if (!isDirty) {
    isDirty = true;
    document.title = 'TacticalPad - ' + cleanTitle + ' ●';
    document.querySelector('.main-area .status-bar span:last-child').textContent = cleanTitle + ' ●';
  }
}

// ---- Render ----
function renderToContext(c, scale, ox, oy) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);
  const extraW = pitch.showBench && pitch.orientation !== 'horizontal' ? 50 : 0;

  c.save(); c.translate(ox, oy); c.scale(scale, scale);
  pitch.draw(c, 1, pitch.view);
  c.restore();

  if (gridEnabled) {
    c.save(); c.translate(ox, oy); c.scale(scale, scale);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 0.5 / scale;
    const dim = pitch.getViewDimensions();
    for (let x = 0; x <= dim.w + extraW; x += dim.w / 6) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, dim.h); c.stroke(); }
    for (let y = 0; y <= dim.h; y += dim.h / 6) { c.beginPath(); c.moveTo(0, y); c.lineTo(dim.w + extraW, y); c.stroke(); }
    c.restore();
  }

  c.save(); c.translate(ox, oy); c.scale(scale, scale);
  drawings.draw(c, 1);
  // Highlight selected drawing
  if (selectedDrawingIndex >= 0 && selectedDrawingIndex < drawings.drawings.length) {
    const d = drawings.drawings[selectedDrawingIndex];
    const bounds = drawings.getBounds(d);
    if (bounds) {
      c.strokeStyle = '#e94560'; c.lineWidth = 2 / scale; c.setLineDash([4 / scale, 3 / scale]);
      c.strokeRect(bounds.x - 3 / scale, bounds.y - 3 / scale, bounds.w + 6 / scale, bounds.h + 6 / scale);
      c.setLineDash([]);
    }
  }
  c.restore();

  // Temp pen stroke
  if (drawings.isDrawing && drawings.tempDrawing) {
    c.save(); c.translate(ox, oy); c.scale(scale, scale);
    const d = drawings.tempDrawing;
    c.strokeStyle = d.color; c.lineWidth = d.width; c.lineCap = 'round'; c.lineJoin = 'round';
    drawings.setLineStyle(c, 1, d.lineStyle || 'solid');
    c.beginPath(); c.moveTo(d.points[0].x, d.points[0].y);
    for (let i = 1; i < d.points.length; i++) c.lineTo(d.points[i].x, d.points[i].y);
    c.stroke(); c.setLineDash([]);
    c.restore();
  }

  c.save(); c.translate(ox, oy); c.scale(scale, scale);
  equipment.draw(c, 1);
  c.restore();

  c.save(); c.translate(ox, oy); c.scale(scale, scale);
  players.draw(c, 1, searchTerm);
  c.restore();

  if (showLabels) {
    c.save(); c.translate(ox, oy); c.scale(scale, scale);
    players.drawLabels(c, 1);
    c.restore();
  }

  // Player-connected shapes
  c.save(); c.translate(ox, oy); c.scale(scale, scale);
  connections.forEach((conn, ci) => {
    const pts = conn.points.map(p => {
      if (p.playerIndex != null && players.players[p.playerIndex]) {
        const pl = players.players[p.playerIndex];
        return { x: pl.x, y: pl.y };
      }
      return { x: p.x, y: p.y };
    });
    if (pts.length < 2) return;
    c.globalAlpha = conn.opacity;
    c.strokeStyle = conn.color;
    c.lineWidth = conn.lineWidth;
    c.setLineDash([]);
    if (conn.type === 'triangle' && pts.length >= 3) {
      c.fillStyle = conn.fill;
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      c.lineTo(pts[1].x, pts[1].y);
      c.lineTo(pts[2].x, pts[2].y);
      c.closePath();
      c.fill(); c.stroke();
    } else if (conn.type === 'connector') {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
      c.stroke();
    }
    c.globalAlpha = 1;
  });

  // In-progress placement preview
  if (connPlacement) {
    const pts = connPlacement.points.map(p => {
      if (p.playerIndex != null && players.players[p.playerIndex]) {
        const pl = players.players[p.playerIndex];
        return { x: pl.x, y: pl.y };
      }
      return { x: p.x, y: p.y };
    });
    if (pts.length > 0) {
      c.strokeStyle = '#ffdd00';
      c.lineWidth = 2;
      c.globalAlpha = 0.7;
      pts.forEach((p, i) => {
        c.fillStyle = '#ffdd00';
        c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(p.x, p.y, 2, 0, Math.PI * 2); c.fill();
        if (i > 0) { c.beginPath(); c.moveTo(pts[i-1].x, pts[i-1].y); c.lineTo(p.x, p.y); c.stroke(); }
      });
      c.globalAlpha = 1;
    }
  }
  c.restore();

  // Rubber band
  if (rubberBand) {
    c.save(); c.translate(ox, oy); c.scale(scale, scale);
    c.strokeStyle = '#ffdd00'; c.lineWidth = 1.5 / scale; c.setLineDash([4/scale, 3/scale]);
    const x = Math.min(rubberBand.x1, rubberBand.x2);
    const y = Math.min(rubberBand.y1, rubberBand.y2);
    const w = Math.abs(rubberBand.x2 - rubberBand.x1);
    const h = Math.abs(rubberBand.y2 - rubberBand.y1);
    c.strokeRect(x, y, w, h);
    c.fillStyle = 'rgba(255,221,0,0.05)';
    c.fillRect(x, y, w, h);
    c.setLineDash([]);
    c.restore();
  }

  // Selected text outline
  if (selectedTextIndex >= 0) {
    const d = drawings.drawings[selectedTextIndex];
    if (d && d.type === 'text' && d.x != null && d.y != null) {
      c.save(); c.translate(ox, oy); c.scale(scale, scale);
      const fs = (d.fontSize || 28);
      c.font = `${fs}px -apple-system, sans-serif`;
      const m = c.measureText(d.text || '');
      const tw = m.width;
      const th = fs * 1.2;
      const rx = d.x - tw / 2 - 4;
      const ry = d.y - th / 2 - 4;
      const rw = tw + 8;
      const rh = th + 8;
      c.strokeStyle = '#ffdd00'; c.lineWidth = 1 / scale; c.setLineDash([3/scale, 2/scale]);
      c.strokeRect(rx, ry, rw, rh);
      c.setLineDash([]);
      c.restore();
    } else if (d && d.points && d.points.length >= 2) {
      c.save(); c.translate(ox, oy); c.scale(scale, scale);
      const rx = Math.min(d.points[0].x, d.points[1].x);
      const ry = Math.min(d.points[0].y, d.points[1].y);
      const rw = Math.abs(d.points[1].x - d.points[0].x);
      const rh = Math.abs(d.points[1].y - d.points[0].y);
      c.strokeStyle = '#ffdd00'; c.lineWidth = 1.5 / scale; c.setLineDash([4/scale, 3/scale]);
      c.strokeRect(rx, ry, rw, rh);
      c.setLineDash([]);
      c.restore();
    }
  }
}

function render() {
  renderToContext(ctx, canvasScale, pitchOffsetX, pitchOffsetY);
}

// ---- Coordinate helpers ----
function getCanvasCoords(e) {
  const r = canvas.getBoundingClientRect();
  const cssX = e.clientX - r.left, cssY = e.clientY - r.top;
  const devX = cssX * (canvas.width / canvas.offsetWidth);
  const devY = cssY * (canvas.height / canvas.offsetHeight);
  return { x: (devX - pitchOffsetX) / canvasScale, y: (devY - pitchOffsetY) / canvasScale };
}

function getDevCoords(e) {
  const r = canvas.getBoundingClientRect();
  const cssX = e.clientX - r.left, cssY = e.clientY - r.top;
  return { x: cssX * (canvas.width / canvas.offsetWidth), y: cssY * (canvas.height / canvas.offsetHeight) };
}

function snapToGrid(x, y) {
  if (!snapEnabled) return { x, y };
  const dim = pitch.getViewDimensions();
  const gridX = dim.w / 12, gridY = dim.h / 14;
  return { x: Math.round(x / gridX) * gridX, y: Math.round(y / gridY) * gridY };
}

// ---- Mouse handlers ----
let dragPlayerIndex = -1;
let dragEquipIndex = -1;
let dragTextIndex = -1;
let dragOffX = 0, dragOffY = 0;
let dragStartPositions = null;

canvas.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(e); });

canvas.addEventListener('dblclick', e => {
  const dev = getDevCoords(e);
  const hit = drawings.hitTestText(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
  if (hit >= 0) showTextEditor(drawings.drawings[hit], hit);

  // Finalize connection placement
  if (currentTool === 'triangle' || currentTool === 'connector') {
    if (connPlacement && connPlacement.points.length >= 2) createConnection();
    else connPlacement = null;
    render();
  }
});

canvas.addEventListener('mousedown', e => {
  if (isAnimating) return;
  const dev = getDevCoords(e);
  const pos = getCanvasCoords(e);
  const snapped = snapToGrid(pos.x, pos.y);

  if (e.button === 1) {
    isPanning = true; panStartX = e.clientX - panX; panStartY = e.clientY - panY;
    canvas.style.cursor = 'grabbing'; return;
  }

  if (currentTool === 'select') {
    // Check equipment (on top)
    const eIdx = equipment.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (eIdx >= 0) {
      if (e.shiftKey) { equipment.selectedIndices.add(eIdx); }
      else { equipment.select(eIdx); players.selectedIndices.clear(); }
      selectedTextIndex = -1; selectedDrawingIndex = -1;
      dragEquipIndex = eIdx;
      const item = equipment.items[eIdx];
      dragOffX = dev.x - pitchOffsetX - item.x * canvasScale;
      dragOffY = dev.y - pitchOffsetY - item.y * canvasScale;
      dragStartPositions = equipment.items.map(it => ({ x: it.x, y: it.y }));
      render(); updateUI(); return;
    }

    const idx = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (idx >= 0) {
      if (e.shiftKey) { players.toggleSelect(idx); }
      else { players.select(idx); equipment.selectedIndices.clear(); }
      selectedTextIndex = -1; selectedDrawingIndex = -1;
      dragPlayerIndex = idx;
      const p = players.getPlayer(idx);
      if (p) { dragOffX = dev.x - pitchOffsetX - p.x * canvasScale; dragOffY = dev.y - pitchOffsetY - p.y * canvasScale; }
      dragStartPositions = players.players.map(pl => ({ x: pl.x, y: pl.y }));
      render(); updateUI(); return;
    }

    // Check text drawings
    const textHit = drawings.hitTestText(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    selectedTextIndex = textHit;
    if (textHit >= 0) {
      players.selectedIndices.clear();
      equipment.selectedIndices.clear();
      selectedDrawingIndex = -1;
      const d = drawings.drawings[textHit];
      dragTextIndex = textHit;
      dragOffX = dev.x - pitchOffsetX - d.x * canvasScale;
      dragOffY = dev.y - pitchOffsetY - d.y * canvasScale;
      render(); updateUI(); return;
    }

    // Check other drawings (rect, circle, line, arrow, etc.)
    const drawHit = drawings.hitTest(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (drawHit >= 0) {
      players.selectedIndices.clear();
      equipment.selectedIndices.clear();
      selectedTextIndex = -1;
      selectedDrawingIndex = drawHit;
      render(); updateUI(); return;
    }

    // Start rubber band
    players.selectedIndices.clear();
    equipment.selectedIndices.clear();
    selectedTextIndex = -1;
    selectedDrawingIndex = -1;
    rubberBand = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
    render(); updateUI(); return;
  }

  if (currentTool === 'eraser') {
    const cx = dev.x - pitchOffsetX, cy = dev.y - pitchOffsetY;
    const hd = drawings.hitTest(cx, cy, canvasScale);
    if (hd >= 0) { drawings.removeAt(hd); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); return; }
    const he = equipment.findByCanvasPos(cx, cy, canvasScale);
    if (he >= 0) { equipment.remove(he); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); return; }
    const hp = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (hp >= 0) { players.remove(hp); cleanupConnections(); history.push(players.players, drawings.drawings, equipment.items, connections); markDirty(); render(); updateUI(); return; }
    return;
  }

  if (currentTool === 'text') {
    const textSize = parseInt(document.getElementById('textSize').value);
    drawings.currentFontSize = textSize;
    drawings.drawings.push({ type: 'text', x: snapped.x, y: snapped.y, text: '', fontSize: textSize, color: drawings.currentColor, opacity: drawings.currentOpacity });
    const idx = drawings.drawings.length - 1;
    selectedTextIndex = idx;
    render();
    showTextEditor(drawings.drawings[idx], idx);
    return;
  }

  if (currentTool === 'triangle' || currentTool === 'connector') {
    // Link to player if clicked on one
    let playerIndex = null;
    const ci = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (ci >= 0) playerIndex = ci;
    const pt = { x: snapped.x, y: snapped.y, playerIndex };
    if (!connPlacement) {
      connPlacement = { type: currentTool, points: [pt] };
    } else {
      connPlacement.points.push(pt);
    }
    render(); return;
  }

  drawings.startStroke(currentTool, snapped.x, snapped.y, drawings.currentColor, drawings.currentWidth);
  if (currentTool !== 'pen') { render(); ctx.save(); ctx.translate(pitchOffsetX, pitchOffsetY); ctx.scale(canvasScale, canvasScale); drawings.drawPreview(ctx, 1, currentTool, { x: snapped.x, y: snapped.y }, { x: snapped.x, y: snapped.y }); ctx.restore(); }
});

canvas.addEventListener('mousemove', e => {
  const dev = getDevCoords(e);
  const coords = getCanvasCoords(e);
  document.getElementById('statusCoords').textContent = `${Math.round(coords.x)}, ${Math.round(coords.y)}`;

  if (isPanning) { panX = e.clientX - panStartX; panY = e.clientY - panStartY; resizeCanvas(); return; }

  if (currentTool === 'select') {
    canvas.style.cursor = 'default';
    const textHit = drawings.hitTestText(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    const pIdx = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    const eIdx = equipment.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (pIdx >= 0 || eIdx >= 0 || textHit >= 0) canvas.style.cursor = 'grab';
  } else if (currentTool === 'eraser') {
    canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Crect x=%224%22 y=%228%22 width=%2224%22 height=%2216%22 rx=%223%22 fill=%22%23e94560%22 stroke=%22%23900%22 stroke-width=%221.5%22/%3E%3Crect x=%228%22 y=%2212%22 width=%2216%22 height=%221%22 fill=%22%23fff%22/%3E%3Cpath d=%22M6 24 L14 28 L26 24%22 fill=%22none%22 stroke=%22%23900%22 stroke-width=%221.5%22/%3E%3C/svg%3E") 16 16, crosshair';
  } else canvas.style.cursor = 'crosshair';

  // Drag players (single or multi)
  if (dragPlayerIndex >= 0) {
    if (!dragStartPositions) dragStartPositions = players.players.map(pl => ({ x: pl.x, y: pl.y }));
    const dx = (dev.x - pitchOffsetX - dragOffX) / canvasScale - dragStartPositions[dragPlayerIndex].x;
    const dy = (dev.y - pitchOffsetY - dragOffY) / canvasScale - dragStartPositions[dragPlayerIndex].y;
    const dim = pitch.getViewDimensions();
    for (const si of players.selectedIndices) {
      const base = dragStartPositions[si];
      if (base) {
        const sp = snapToGrid(base.x + dx, base.y + dy);
        players.players[si].x = Math.max(0, Math.min(dim.w, sp.x));
        players.players[si].y = Math.max(0, Math.min(dim.h, sp.y));
      }
    }
    render(); updateUI(); return;
  }

  // Drag equipment (single or multi)
  if (dragEquipIndex >= 0) {
    if (!dragStartPositions) dragStartPositions = equipment.items.map(it => ({ x: it.x, y: it.y }));
    const dx = (dev.x - pitchOffsetX - dragOffX) / canvasScale - dragStartPositions[dragEquipIndex].x;
    const dy = (dev.y - pitchOffsetY - dragOffY) / canvasScale - dragStartPositions[dragEquipIndex].y;
    const dim = pitch.getViewDimensions();
    for (const si of equipment.selectedIndices) {
      const base = dragStartPositions[si];
      if (base) {
        const sp = snapToGrid(base.x + dx, base.y + dy);
        equipment.items[si].x = Math.max(0, Math.min(dim.w + 50, sp.x));
        equipment.items[si].y = Math.max(0, Math.min(dim.h, sp.y));
      }
    }
    render(); updateUI(); return;
  }

  // Drag text
  if (dragTextIndex >= 0) {
    const d = drawings.drawings[dragTextIndex];
    if (d) {
      const nx = (dev.x - pitchOffsetX - dragOffX) / canvasScale;
      const ny = (dev.y - pitchOffsetY - dragOffY) / canvasScale;
      d.x = nx; d.y = ny;
    }
    render(); return;
  }

  // Rubber band
  if (rubberBand) {
    const pos = getCanvasCoords(e);
    rubberBand.x2 = pos.x; rubberBand.y2 = pos.y;
    players.selectInRect(rubberBand.x1, rubberBand.y1, rubberBand.x2, rubberBand.y2);
    equipment.selectInRect(rubberBand.x1, rubberBand.y1, rubberBand.x2, rubberBand.y2);
    render(); updateUI(); return;
  }

  if (!drawings.isDrawing) return;
  const coords2 = getCanvasCoords(e);
  const snapped2 = snapToGrid(coords2.x, coords2.y);

  if (currentTool === 'pen') {
    drawings.continueStroke(currentTool, snapped2.x, snapped2.y); render();
  } else {
    render();
    ctx.save(); ctx.translate(pitchOffsetX, pitchOffsetY); ctx.scale(canvasScale, canvasScale);
    drawings.drawPreview(ctx, 1, currentTool, drawings.drawStart, snapped2);
    ctx.restore();
  }
});

canvas.addEventListener('mouseup', e => {
  if (isPanning) { isPanning = false; canvas.style.cursor = currentTool === 'select' ? 'default' : 'crosshair'; return; }

  if (rubberBand) {
    rubberBand = null; render(); return;
  }

  if (dragPlayerIndex >= 0 || dragEquipIndex >= 0 || dragTextIndex >= 0) {
    dragPlayerIndex = -1; dragEquipIndex = -1; dragTextIndex = -1; dragStartPositions = null;
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); return;
  }

  if (!drawings.isDrawing) return;
  const coords = getCanvasCoords(e);
  const snapped = snapToGrid(coords.x, coords.y);
  const result = drawings.endStroke(currentTool, snapped.x, snapped.y);
  if (result) { 
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections);
    if (result.type === 'textbox') {
      const idx = drawings.drawings.indexOf(result);
      showTextEditor(result, idx);
    }
  }
  render();
});

// ---- Zoom ----
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (viewLocked) return;
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  zoom = Math.max(0.3, Math.min(3, zoom + delta));
  document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
  resizeCanvas();
}, { passive: false });

// ---- Touch (direct, no synthetic mouse events) ----
let lastTouchDist = 0;
let pinchActive = false;
let pinchCenter = null;
let touchDragIdx = -1;

function isOverlayBtn(el) {
  while (el) {
    if (el.classList && el.classList.contains('tablet-reset-btn')) return true;
    el = el.parentElement;
  }
  return false;
}

canvas.addEventListener('touchstart', e => {
  if (isOverlayBtn(e.target)) return;
  if (e.touches.length === 2) {
    if (!viewLocked) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.hypot(dx, dy);
      pinchCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
      pinchActive = true;
    }
    e.preventDefault();
    return;
  }
  if (pinchActive) return;
  e.preventDefault();
  const t = e.touches[0];
  const dev = getDevCoords({ clientX: t.clientX, clientY: t.clientY });
  const coords = getCanvasCoords({ clientX: t.clientX, clientY: t.clientY });

  if (currentTool === 'select') {
    const pIdx = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    const eIdx = equipment.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    const textHit = drawings.hitTestText(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);

    selectedDrawingIndex = -1; selectedTextIndex = -1;

    if (textHit >= 0) {
      players.selectedIndices.clear();
      equipment.selectedIndices.clear();
      selectedDrawingIndex = -1;
      selectedTextIndex = textHit;
      const d = drawings.drawings[textHit];
      dragTextIndex = textHit;
      dragOffX = dev.x - pitchOffsetX - d.x * canvasScale;
      dragOffY = dev.y - pitchOffsetY - d.y * canvasScale;
    } else {
      const drawHit = drawings.hitTest(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
      if (drawHit >= 0) {
        players.selectedIndices.clear();
        equipment.selectedIndices.clear();
        selectedDrawingIndex = drawHit;
      } else if (eIdx >= 0) {
        equipment.selectedIndices.clear();
        equipment.selectedIndices.add(eIdx);
        dragEquipIndex = eIdx;
        const item = equipment.items[eIdx];
        dragOffX = dev.x - pitchOffsetX - item.x * canvasScale;
        dragOffY = dev.y - pitchOffsetY - item.y * canvasScale;
        dragStartPositions = equipment.items.map(it => ({ x: it.x, y: it.y }));
      } else if (pIdx >= 0) {
        players.selectedIndices.clear();
        players.selectedIndices.add(pIdx);
        players.selected = players.players[pIdx];
        touchDragIdx = pIdx;
        const p = players.getPlayer(pIdx);
        if (p) { dragOffX = dev.x - pitchOffsetX - p.x * canvasScale; dragOffY = dev.y - pitchOffsetY - p.y * canvasScale; }
        dragStartPositions = players.players.map(pl => ({ x: pl.x, y: pl.y }));
      } else {
        players.selectedIndices.clear();
        equipment.selectedIndices.clear();
        players.selected = null;
      }
    }
    updateUI(); render();
  } else if (currentTool === 'pen' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'dashed' || currentTool === 'rect' || currentTool === 'circle') {
    drawings.startStroke(currentTool, coords.x, coords.y, drawings.currentColor, drawings.currentWidth);
  } else if (currentTool === 'eraser') {
    const cx = dev.x - pitchOffsetX, cy = dev.y - pitchOffsetY;
    const hd = drawings.hitTest(cx, cy, canvasScale);
    if (hd >= 0) { drawings.removeAt(hd); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); return; }
    const he = equipment.findByCanvasPos(cx, cy, canvasScale);
    if (he >= 0) { equipment.remove(he); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); return; }
    const hp = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (hp >= 0) { players.remove(hp); cleanupConnections(); history.push(players.players, drawings.drawings, equipment.items, connections); markDirty(); render(); updateUI(); return; }
  } else if (currentTool === 'text') {
    const textSize = parseInt(document.getElementById('textSize').value);
    drawings.currentFontSize = textSize;
    const snapped = snapToGrid(coords.x, coords.y);
    drawings.drawings.push({ type: 'text', x: snapped.x, y: snapped.y, text: '', fontSize: textSize, color: drawings.currentColor, opacity: drawings.currentOpacity });
    const idx = drawings.drawings.length - 1;
    selectedTextIndex = idx;
    render();
    showTextEditor(drawings.drawings[idx], idx);
  } else if (currentTool === 'triangle' || currentTool === 'connector') {
    let playerIndex = null;
    const ci = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
    if (ci >= 0) playerIndex = ci;
    const snapped = snapToGrid(coords.x, coords.y);
    const pt = { x: snapped.x, y: snapped.y, playerIndex };
    if (!connPlacement) {
      connPlacement = { type: currentTool, points: [pt] };
    } else {
      connPlacement.points.push(pt);
    }
    render();
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (isOverlayBtn(e.target)) return;
  if (e.touches.length === 2) {
    e.preventDefault();
    if (viewLocked) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (lastTouchDist > 0) {
      const oldZoom = zoom;
      zoom = Math.max(0.3, Math.min(3, zoom + (dist - lastTouchDist) / lastTouchDist));
      const r = canvas.getBoundingClientRect();
      const focusX = (pinchCenter.x - r.left) * (canvas.width / canvas.offsetWidth);
      const focusY = (pinchCenter.y - r.top) * (canvas.height / canvas.offsetHeight);
      panX = focusX - (focusX - panX) * (zoom / oldZoom);
      panY = focusY - (focusY - panY) * (zoom / oldZoom);
    }
    document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
    lastTouchDist = dist;
    resizeCanvas();
    return;
  }
  if (pinchActive) return;
  e.preventDefault();
  const t = e.touches[0];
  const dev = getDevCoords({ clientX: t.clientX, clientY: t.clientY });
  const coords = getCanvasCoords({ clientX: t.clientX, clientY: t.clientY });

  if (touchDragIdx >= 0 && currentTool === 'select') {
    const dx = (dev.x - pitchOffsetX - dragOffX) / canvasScale - dragStartPositions[touchDragIdx].x;
    const dy = (dev.y - pitchOffsetY - dragOffY) / canvasScale - dragStartPositions[touchDragIdx].y;
    const dim = pitch.getViewDimensions();
    for (const idx of players.selectedIndices) {
      const base = dragStartPositions[idx];
      if (base) {
        const sp = snapToGrid(base.x + dx, base.y + dy);
        players.players[idx].x = Math.max(0, Math.min(dim.w, sp.x));
        players.players[idx].y = Math.max(0, Math.min(dim.h, sp.y));
      }
    }
    updateUI(); render();
  } else if (dragEquipIndex >= 0 && currentTool === 'select') {
    const dx = (dev.x - pitchOffsetX - dragOffX) / canvasScale - dragStartPositions[dragEquipIndex].x;
    const dy = (dev.y - pitchOffsetY - dragOffY) / canvasScale - dragStartPositions[dragEquipIndex].y;
    const dim = pitch.getViewDimensions();
    for (const si of equipment.selectedIndices) {
      const base = dragStartPositions[si];
      if (base) {
        const sp = snapToGrid(base.x + dx, base.y + dy);
        equipment.items[si].x = Math.max(0, Math.min(dim.w + 50, sp.x));
        equipment.items[si].y = Math.max(0, Math.min(dim.h, sp.y));
      }
    }
    updateUI(); render();
  } else if (dragTextIndex >= 0 && currentTool === 'select') {
    const d = drawings.drawings[dragTextIndex];
    if (d) {
      const nx = (dev.x - pitchOffsetX - dragOffX) / canvasScale;
      const ny = (dev.y - pitchOffsetY - dragOffY) / canvasScale;
      d.x = nx; d.y = ny;
    }
    render();
  } else if (currentTool === 'pen' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'dashed' || currentTool === 'rect' || currentTool === 'circle') {
    drawings.continueStroke(coords.x, coords.y);
    render();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (isOverlayBtn(e.target)) return;
  if (pinchActive) { pinchActive = false; pinchCenter = null; return; }
  if (touchDragIdx >= 0) {
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections);
    touchDragIdx = -1; dragEquipIndex = -1; dragStartPositions = null;
    render(); updateUI();
  } else if (dragEquipIndex >= 0) {
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections);
    dragEquipIndex = -1; dragStartPositions = null;
    render(); updateUI();
  } else if (dragTextIndex >= 0) {
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections);
    dragTextIndex = -1; dragStartPositions = null;
    render(); updateUI();
  } else if (touchDragIdx === -1 && (currentTool === 'pen' || currentTool === 'line' || currentTool === 'arrow' || currentTool === 'dashed' || currentTool === 'rect' || currentTool === 'circle')) {
    const ct = e.changedTouches[0];
    const coords = getCanvasCoords({ clientX: ct.clientX, clientY: ct.clientY });
    drawings.endStroke(currentTool, coords.x, coords.y);
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections);
    render();
  }
}, { passive: false });

// ---- Keyboard ----
document.addEventListener('keydown', e => {
  if (isAnimating && e.key !== 'Escape') return;
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveFile(); return; }
  if (e.ctrlKey && e.key === 'p') { e.preventDefault(); window.print(); return; }
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportPng(); return; }
  if (e.ctrlKey && e.key === 'c') { e.preventDefault(); copySelection(); return; }
  if (e.ctrlKey && e.key === 'v') { e.preventDefault(); pasteSelection(); return; }
  if (e.ctrlKey && e.key === 'a') { e.preventDefault(); players.selectAll(); render(); updateUI(); return; }
  if (e.ctrlKey && e.key === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (e.key === 'Escape' && isAnimating) {
    e.preventDefault();
    isAnimating = false;
    animation.stop(players.players, equipment.items);
    updateTimeline(); render(); updateUI();
    return;
  }
  // Cancel or finalize connection placement
  if (currentTool === 'triangle' || currentTool === 'connector') {
    if (e.key === 'Escape' && connPlacement) {
      connPlacement = null; render(); return;
    }
    if (e.key === 'Enter' && connPlacement && connPlacement.points.length >= 2) {
      createConnection(); return;
    }
  }
  if (e.key === ' ' && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    if (animation.keyframes.length < 2) return;
    if (animation.isPlaying) {
      animation.pause();
      updateTimeline();
    } else {
      isAnimating = true;
      players.selectedIndices.clear();
      equipment.selectedIndices.clear();
      animation.play(players.players, equipment.items);
      updateTimeline(); render(); updateUI();
    }
    return;
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    animation.addKeyframe(players.players, equipment.items);
    updateTimeline();
    return;
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    if (players.selectedIndices.size > 0 || equipment.selectedIndices.size > 0 || selectedTextIndex >= 0 || selectedDrawingIndex >= 0) {
      e.preventDefault();
      deleteSelected();
    }
  }

  // Rotate selected player direction (R key)
  if (e.key === 'r' && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
    if (players.selectedIndices.size > 0) {
      for (const si of players.selectedIndices) {
        players.players[si].direction = (players.players[si].direction + Math.PI / 4) % (Math.PI * 2);
      }
      markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); e.preventDefault();
    } else if (equipment.selectedIndices.size > 0) {
      for (const si of equipment.selectedIndices) {
        equipment.items[si].rotation = ((equipment.items[si].rotation || 0) + Math.PI / 4) % (Math.PI * 2);
      }
      markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); e.preventDefault();
    }
    return;
  }

  const keyMap = { 'v':'select', 'p':'pen', 'l':'line', 'a':'arrow', 'd':'dashed', 'r':'rect', 'c':'circle', 't':'text', 'e':'eraser' };
  const k = e.key.toLowerCase();
  if (keyMap[k] && document.activeElement?.tagName !== 'INPUT') setTool(keyMap[k]);
});

// ---- Copy/Paste ----
function copySelection() {
  if (players.selectedIndices.size > 0) {
    const copied = [];
    for (const si of players.selectedIndices) copied.push({ ...players.players[si], id: null });
    clipboard = { type: 'players', data: copied };
  } else if (equipment.selectedIndices.size > 0) {
    const copied = [];
    for (const si of equipment.selectedIndices) copied.push({ ...equipment.items[si], id: null });
    clipboard = { type: 'equipment', data: copied.map(item => ({ ...item, size: item.size || 1 })) };
  }
}

function duplicateSelection() {
  if (players.selectedIndices.size > 0) {
    const toDup = [...players.selectedIndices].sort((a, b) => b - a);
    for (const i of toDup) {
      const p = players.players[i];
      if (p) players.add(p.team, players.countByTeam(p.team) + 1, p.name, p.role, p.x + 15, p.y + 15);
    }
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
  } else if (equipment.selectedIndices.size > 0) {
    const toDup = [...equipment.selectedIndices];
    for (const si of toDup) {
      const item = equipment.items[si];
      equipment.add(item.type, item.x + 15, item.y + 15, item.size || 1);
    }
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
  }
}

function pasteSelection() {
  if (!clipboard) return;
  if (clipboard.type === 'players') {
    for (const p of clipboard.data) {
      players.add(p.team, players.countByTeam(p.team) + 1, p.name, p.role, p.x + 15, p.y + 15);
    }
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
  } else if (clipboard.type === 'equipment') {
    for (const item of clipboard.data) {
      equipment.add(item.type, item.x + 15, item.y + 15, item.size || 1);
    }
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
  }
}

// ---- Player-connected shapes ----
function createConnection() {
  if (!connPlacement || connPlacement.points.length < 2) return;
  connections.push({
    type: connPlacement.type,
    points: connPlacement.points.map(p => ({ x: p.x, y: p.y, playerIndex: p.playerIndex })),
    color: '#ffdd00',
    fill: 'rgba(255,221,0,0.12)',
    lineWidth: 2,
    opacity: 0.7
  });
  connPlacement = null;
  markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
}

function removeConnection(idx) {
  if (idx < 0 || idx >= connections.length) return;
  connections.splice(idx, 1);
  markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
}

// Clean up connections that reference deleted players
function cleanupConnections() {
  connections.forEach(conn => {
    conn.points.forEach(p => {
      if (p.playerIndex != null && !players.players[p.playerIndex]) p.playerIndex = null;
    });
  });
}

// ---- Tool management ----
function setTool(tool) {
  if (tool !== 'triangle' && tool !== 'connector' && connPlacement) {
    if (connPlacement.points.length >= 2) createConnection();
    else connPlacement = null;
    render();
  }
  currentTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  canvas.style.cursor = tool === 'select' ? 'default' : tool === 'eraser' ? 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22%3E%3Crect x=%224%22 y=%228%22 width=%2224%22 height=%2216%22 rx=%223%22 fill=%22%23e94560%22 stroke=%22%23900%22 stroke-width=%221.5%22/%3E%3Crect x=%228%22 y=%2212%22 width=%2216%22 height=%221%22 fill=%22%23fff%22/%3E%3Cpath d=%22M6 24 L14 28 L26 24%22 fill=%22none%22 stroke=%22%23900%22 stroke-width=%221.5%22/%3E%3C/svg%3E") 16 16, crosshair' : 'crosshair';
  document.getElementById('statusTool').textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
}

// ---- Context Menu ----
const ctxMenu = document.getElementById('contextMenu');

function showContextMenu(e) {
  const dev = getDevCoords(e);
  const pIdx = players.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
  const eIdx = equipment.findByCanvasPos(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);
  const dIdx = drawings.hitTest(dev.x - pitchOffsetX, dev.y - pitchOffsetY, canvasScale);

  ctxMenu._context = {
    playerIdx: pIdx >= 0 ? players.selectedIndices.has(pIdx) ? -1 : pIdx : -1,
    playerIndices: players.selectedIndices.size > 0 ? [...players.selectedIndices] : (pIdx >= 0 ? [pIdx] : []),
    equipIndices: equipment.selectedIndices.size > 0 ? [...equipment.selectedIndices] : (eIdx >= 0 ? [eIdx] : []),
    drawIdx: dIdx,
    x: getCanvasCoords(e).x, y: getCanvasCoords(e).y
  };

  ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
    const action = item.dataset.action;
    item.style.display = 'block';
    const hasSelection = ctxMenu._context.playerIndices.length > 0 || ctxMenu._context.equipIndices.length > 0 || dIdx >= 0;
    if (['duplicate', 'delete', 'reset-pos'].includes(action)) item.style.display = hasSelection ? 'block' : 'none';
    if (['bring-front', 'send-back'].includes(action)) item.style.display = dIdx >= 0 ? 'block' : 'none';
  });

  ctxMenu.style.left = e.clientX + 'px';
  ctxMenu.style.top = e.clientY + 'px';
  ctxMenu.classList.add('visible');
}

document.addEventListener('click', e => { if (!ctxMenu.contains(e.target)) ctxMenu.classList.remove('visible'); });

ctxMenu.addEventListener('click', e => {
  const item = e.target.closest('.ctx-item');
  if (!item) return;
  const action = item.dataset.action;
  const ctx = ctxMenu._context || {};
  ctxMenu.classList.remove('visible');

  switch (action) {
    case 'duplicate':
      if (ctx.playerIndices?.length > 0) {
        for (const i of ctx.playerIndices) {
          const p = players.players[i];
          if (p) players.add(p.team, players.countByTeam(p.team) + 1, p.name, p.role, p.x + 15, p.y + 15);
        }
        markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
      } else if (ctx.equipIndices?.length > 0) {
        for (const i of ctx.equipIndices) {
          const eq = equipment.items[i];
          if (eq) equipment.add(eq.type, eq.x + 15, eq.y + 15, eq.size || 1);
        }
        markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
      }
      break;
    case 'delete':
      if (ctx.playerIndices?.length > 0) { players.removeAll(new Set(ctx.playerIndices)); cleanupConnections(); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); }
      else if (ctx.equipIndices?.length > 0) { equipment.removeAll(new Set(ctx.equipIndices)); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); }
      else if (ctx.drawIdx >= 0) { drawings.removeAt(ctx.drawIdx); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); }
      break;
    case 'reset-pos':
      if (ctx.playerIndices?.length > 0) {
        const dim = pitch.getViewDimensions();
        for (const i of ctx.playerIndices) { if (players.players[i]) { players.players[i].x = dim.w/2; players.players[i].y = dim.h/2; } }
        markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
      }
      break;
    case 'bring-front':
      if (ctx.drawIdx >= 0) { drawings.bringToFront(ctx.drawIdx); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); }
      break;
    case 'send-back':
      if (ctx.drawIdx >= 0) { drawings.sendToBack(ctx.drawIdx); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); }
      break;
    case 'add-home': {
      const dim = pitch.getViewDimensions();
      players.add('home', players.countByTeam('home') + 1, '', 'MID', ctx.x || dim.w/2, ctx.y || dim.h/2);
      markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); break;
    }
    case 'add-away': {
      const dim = pitch.getViewDimensions();
      players.add('away', players.countByTeam('away') + 1, '', 'MID', ctx.x || dim.w/2, ctx.y || dim.h/2);
      markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); break;
    }
  }
});

// ---- Text Editor (modal dialog) ----
let editingTextIndex = -1;
const textDialog = document.getElementById('textDialog');
const textDialogInput = document.getElementById('textDialogInput');
const textDialogSize = document.getElementById('textDialogSize');
const textDialogSizeLabel = document.getElementById('textDialogSizeLabel');

function showTextEditor(drawing, index) {
  editingTextIndex = index;
  textDialogInput.value = drawing.text || '';
  textDialogSize.value = drawing.fontSize || 28;
  textDialogSizeLabel.textContent = textDialogSize.value;
  textDialog.style.display = 'flex';
  textDialogInput.focus();
  textDialogInput.select();
}

function finishTextEdit(save) {
  if (editingTextIndex >= 0 && editingTextIndex < drawings.drawings.length) {
    const d = drawings.drawings[editingTextIndex];
    if (save) {
      d.text = textDialogInput.value || '';
      d.fontSize = parseInt(textDialogSize.value);
      if (d.text) {
        markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections);
      } else {
        drawings.removeAt(editingTextIndex);
        if (selectedTextIndex === editingTextIndex) selectedTextIndex = -1;
      }
    } else {
      drawings.removeAt(editingTextIndex);
      if (selectedTextIndex === editingTextIndex) selectedTextIndex = -1;
    }
    render();
  }
  textDialog.style.display = 'none';
  editingTextIndex = -1;
}

textDialogInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); finishTextEdit(true); }
  if (e.key === 'Escape') { e.preventDefault(); finishTextEdit(false); }
});
textDialogSize.addEventListener('input', () => {
  textDialogSizeLabel.textContent = textDialogSize.value;
});
document.getElementById('textDialogOk').addEventListener('click', () => finishTextEdit(true));
document.getElementById('textDialogCancel').addEventListener('click', () => finishTextEdit(false));

// ---- UI Updates ----
function updateUI() {
  const list = document.getElementById('playerList');
  const term = document.getElementById('playerSearch').value.toLowerCase();
  list.innerHTML = '';

  const homeCol = document.createElement('div'); homeCol.className = 'player-col';
  const awayCol = document.createElement('div'); awayCol.className = 'player-col';
  const homeTitle = document.createElement('div'); homeTitle.className = 'player-col-title'; homeTitle.textContent = 'Home';
  const awayTitle = document.createElement('div'); awayTitle.className = 'player-col-title'; awayTitle.textContent = 'Away';
  homeCol.appendChild(homeTitle); awayCol.appendChild(awayTitle);

  function addPlayerItem(p, i) {
    if (term && !p.name.toLowerCase().includes(term) && !p.role.toLowerCase().includes(term)) return;
    const div = document.createElement('div');
    div.className = 'player-item' + (players.selectedIndices.has(i) ? ' active' : '');
    const dot = document.createElement('div'); dot.className = 'player-dot'; dot.style.background = players.getColor(p.team); dot.textContent = p.number || '-';
    const nameSpan = document.createElement('span'); nameSpan.className = 'player-name'; nameSpan.textContent = p.name || p.role || 'Player';
    const roleSpan = document.createElement('span'); roleSpan.className = 'player-role-badge'; roleSpan.textContent = p.role || 'MID';
    div.appendChild(dot); div.appendChild(nameSpan); div.appendChild(roleSpan);
    div.addEventListener('click', (ev) => {
      if (ev.shiftKey) { players.toggleSelect(i); } else { players.select(i); equipment.selectedIndices.clear(); }
      render(); updateUI(); loadPlayerProps();
    });
    div.draggable = true;
    div.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', JSON.stringify({ type: 'player', index: i }));
    });
    (p.team === 'away' ? awayCol : homeCol).appendChild(div);
  }

  players.players.forEach((p, i) => addPlayerItem(p, i));
  list.appendChild(homeCol);
  list.appendChild(awayCol);
  document.getElementById('playerCount').textContent = players.count();

  const eqList = document.getElementById('equipList');
  eqList.innerHTML = '';
  equipment.items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'equip-item' + (equipment.selectedIndices.has(i) ? ' active' : '');
    const def = EquipmentManager.TYPES[item.type];
    const dot = document.createElement('div'); dot.className = 'player-dot'; dot.style.background = item.color || def.color; dot.textContent = def.label[0];
    const nameSpan = document.createElement('span'); nameSpan.className = 'player-name'; nameSpan.textContent = def.label;
    div.appendChild(dot); div.appendChild(nameSpan);
    div.addEventListener('click', () => { equipment.select(i); players.selectedIndices.clear(); render(); updateUI(); });
    div.draggable = true;
    div.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', JSON.stringify({ type: 'equipment', kind: item.type }));
    });
    eqList.appendChild(div);
  });
  document.getElementById('statusEquipment').textContent = equipment.items.length + ' items';
  document.getElementById('statusPlayers').textContent = players.count() + ' players';

  // Sync text size slider with selected text drawing
  if (selectedTextIndex >= 0 && drawings.drawings[selectedTextIndex]) {
    const d = drawings.drawings[selectedTextIndex];
    if (d.type === 'textbox' || d.type === 'text') {
      document.getElementById('textSize').value = d.fontSize || 28;
      document.getElementById('textSizeLabel').textContent = d.fontSize || 28;
    }
  }

  // Connections list
  const connList = document.getElementById('connList');
  connList.innerHTML = '';
  connections.forEach((conn, ci) => {
    const div = document.createElement('div');
    div.className = 'equip-item' + (ci === selectedConnection ? ' active' : '');
    const label = conn.type.charAt(0).toUpperCase() + conn.type.slice(1) + ' (' + conn.points.length + ' pts)';
    const dot = document.createElement('div'); dot.className = 'player-dot'; dot.style.background = conn.color; dot.textContent = conn.type === 'triangle' ? '△' : '—';
    const nameSpan = document.createElement('span'); nameSpan.className = 'player-name'; nameSpan.textContent = label;
    const delBtn = document.createElement('button'); delBtn.textContent = '✕'; delBtn.style.cssText = 'background:none;border:none;color:#e94560;cursor:pointer;font-size:11px;margin-left:auto';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); removeConnection(ci); });
    div.appendChild(dot); div.appendChild(nameSpan); div.appendChild(delBtn);
    div.addEventListener('click', () => { selectedConnection = ci; render(); updateUI(); });
    connList.appendChild(div);
  });
  document.getElementById('connCount').textContent = connections.length;

  // Sync equipment size slider with selected item
  if (equipment.selectedIndices.size > 0) {
    const ei = [...equipment.selectedIndices];
    const last = equipment.items[ei[ei.length - 1]];
    const val = last.size || 1;
    document.getElementById('equipSize').value = val;
    document.getElementById('equipSizeVal').textContent = val;
    const rot = Math.round((last.rotation || 0) * 180 / Math.PI);
    document.getElementById('equipRot').value = rot;
    document.getElementById('equipRotVal').textContent = rot + '°';
  }

  if (players.selectedIndices.size > 0) loadPlayerProps();
  else clearPlayerProps();
}

// Drag-and-drop from panel to canvas
canvas.addEventListener('dragover', e => e.preventDefault());
canvas.addEventListener('drop', e => {
  e.preventDefault();
  try {
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const pos = getCanvasCoords(e);
    if (data.type === 'player') {
      players.add('home', players.countByTeam('home') + 1, '', 'MID', pos.x, pos.y);
      markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
    } else if (data.type === 'equipment') {
      const sz = parseFloat(document.getElementById('equipSize').value);
      equipment.add(data.kind, pos.x, pos.y, sz);
      markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
    }
  } catch(e) {}
});

function loadPlayerProps() {
  const p = players.selected;
  if (!p) return;
  document.getElementById('playerName').value = p.name || '';
  document.getElementById('playerNumber').value = p.number || '';
  document.getElementById('playerTeam').value = p.team;
  document.getElementById('playerRole').value = p.role || 'MID';
  const faceSection = document.getElementById('faceSection');
  faceSection.style.display = 'block';
  document.getElementById('faceZoom').value = p.faceZoom || 1;
  document.getElementById('faceZoomLabel').textContent = (p.faceZoom || 1).toFixed(1);
  document.getElementById('faceOffsetX').value = p.faceOffsetX || 0;
  document.getElementById('faceOffsetY').value = p.faceOffsetY || 0;
}
function clearPlayerProps() {
  document.getElementById('playerName').value = ''; document.getElementById('playerNumber').value = '';
  document.getElementById('playerTeam').value = 'home'; document.getElementById('playerRole').value = 'MID';
  document.getElementById('faceSection').style.display = 'none';
}

// ---- Animation / Timeline ----
function updateTimeline() {
  const track = document.getElementById('tlTrack');
  const playhead = document.getElementById('tlPlayhead');
  const timeLabel = document.getElementById('tlTime');
  const keyCount = document.getElementById('tlKeyCount');
  const duration = animation.totalDuration;

  // Remove old keyframe dots
  track.querySelectorAll('.tl-keyframe').forEach(el => el.remove());

  // Add keyframe dots
  animation.keyframes.forEach((kf, i) => {
    const pct = duration > 0 ? (kf.time / duration) * 100 : 0;
    const dot = document.createElement('div');
    dot.className = 'tl-keyframe' + (i === animation.currentKeyframeIndex ? ' active' : '');
    dot.style.left = pct + '%';
    dot.title = 'Keyframe ' + (i + 1) + ' @ ' + kf.time.toFixed(1) + 's';
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!animation.isPlaying) {
        animation.seek(kf.time, players.players, equipment.items);
        updateTimeline(); render();
      }
    });
    track.appendChild(dot);
  });

  // Update playhead position
  const pct = duration > 0 ? (animation.currentTime / duration) * 100 : 0;
  playhead.style.left = pct + '%';
  timeLabel.textContent = animation.currentTime.toFixed(1) + 's';
  keyCount.textContent = animation.keyframes.length;

  // Update play button
  const playBtn = document.getElementById('tlPlay');
  playBtn.textContent = animation.isPlaying ? '⏸' : '▶';
  playBtn.classList.toggle('active', animation.isPlaying);
}

function onTimelineSeek(e) {
  if (animation.isPlaying) return;
  const track = document.getElementById('tlTrack');
  const rect = track.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const time = pct * animation.totalDuration;
  animation.seek(time, players.players, equipment.items);
  updateTimeline(); render();
}

// ---- Undo/Redo ----
function undo() {
  const snap = history.undo();
  if (!snap) return;
  players.players = JSON.parse(JSON.stringify(snap.players));
  drawings.drawings = JSON.parse(JSON.stringify(snap.drawings));
  equipment.items = JSON.parse(JSON.stringify(snap.equipment || []));
  connections = JSON.parse(JSON.stringify(snap.connections || []));
  render(); updateUI();
}
function redo() {
  const snap = history.redo();
  if (!snap) return;
  players.players = JSON.parse(JSON.stringify(snap.players));
  drawings.drawings = JSON.parse(JSON.stringify(snap.drawings));
  equipment.items = JSON.parse(JSON.stringify(snap.equipment || []));
  connections = JSON.parse(JSON.stringify(snap.connections || []));
  render(); updateUI();
}

// ---- File operations ----
function serialize() {
  return JSON.stringify({
    version: '2.1', players: players.players, drawings: drawings.drawings, equipment: equipment.items, connections: connections,
    pitchStyle: pitch.style, lineColor: pitch.lineColor, homeColor: players.homeColor, awayColor: players.awayColor,
    view: pitch.view, showBench: pitch.showBench
  }, null, 2);
}

function saveFile() {
  const data = serialize();
  if (window.electronAPI) window.electronAPI.saveFile(data);
  else { const blob = new Blob([data], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tactics.tactics'; a.click(); URL.revokeObjectURL(blob); }
}
function saveAsFile() {
  if (window.electronAPI) window.electronAPI.saveAsFile(serialize());
}
function exportPng() {
  if (window.electronAPI) window.electronAPI.exportPng(canvas.toDataURL('image/png'));
  else { const a=document.createElement('a'); a.download='tactics.png'; a.href=canvas.toDataURL('image/png'); a.click(); }
}
function exportSvg() {
  const dataUrl = canvas.toDataURL('image/png');
  const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.offsetWidth}" height="${canvas.offsetHeight}" viewBox="0 0 ${canvas.offsetWidth} ${canvas.offsetHeight}"><image width="${canvas.offsetWidth}" height="${canvas.offsetHeight}" xlink:href="${dataUrl}"/></svg>`;
  if (window.electronAPI) window.electronAPI.exportSvg(svg);
  else { const blob=new Blob([svg],{type:'image/svg+xml'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='tactics.svg'; a.click(); URL.revokeObjectURL(blob); }
}

function loadFromFile(data) {
  try {
    const d = JSON.parse(data);
    if (d && d.version && !d.version.startsWith('2')) {
      console.warn('Loading file with unknown version:', d.version);
    }
    isAnimating = false; animation.clearKeyframes(); animation.stop(players.players, equipment.items);
    players.players = d.players || []; drawings.drawings = d.drawings || []; equipment.items = d.equipment || [];
    selectedDrawingIndex = -1; selectedTextIndex = -1;
    connections = (d.connections || []).map(c => {
      // Convert old format (playerIndices) to new format (points)
      if (c.playerIndices && !c.points) {
        return { ...c, points: c.playerIndices.map(pi => ({ x: 0, y: 0, playerIndex: pi })) };
      }
      return c;
    });
    if (d.pitchStyle) pitch.style = d.pitchStyle;
    if (d.lineColor) pitch.lineColor = d.lineColor;
    if (d.homeColor) players.homeColor = d.homeColor;
    if (d.awayColor) players.awayColor = d.awayColor;
    if (d.view) pitch.view = d.view;
    if (d.showBench !== undefined) pitch.showBench = d.showBench;
    document.getElementById('pitchStyle').value = pitch.style;
    document.getElementById('pitchLineColor').value = pitch.lineColor;
    document.getElementById('homeColor').value = players.homeColor;
    document.getElementById('awayColor').value = players.awayColor;
    document.getElementById('pitchView').value = pitch.view;
    document.getElementById('chkBench').checked = pitch.showBench;
    history.clear(); history.push(players.players, drawings.drawings, equipment.items, connections);
    isDirty = false; render(); updateUI();
  } catch(e) { console.error('Load failed:', e); }
}

// Auto-backup every 30 seconds
function startAutoBackup() {
  // Restore from previous session
  try {
    const saved = localStorage.getItem('tacticalpad-autobackup');
    if (saved) {
      const d = JSON.parse(saved);
      if (d && d.players && d.players.length > 0) {
        loadFromFile(saved);
        // Mark as clean since this is a restored session
        isDirty = false;
        cleanTitle = 'Recovered';
        document.getElementById('statusFile').textContent = cleanTitle;
        document.title = 'TacticalPad - ' + cleanTitle;
      }
    }
  } catch(e) { /* silent */ }

  if (autoSaveTimer) clearInterval(autoSaveTimer);
  autoSaveTimer = setInterval(() => {
    try { localStorage.setItem('tacticalpad-autobackup', serialize()); } catch(e) {}
  }, 30000);
}

// ---- UI Event Listeners ----
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redo);
document.getElementById('btnClearAll').addEventListener('click', () => {
  if (drawings.drawings.length === 0 && equipment.items.length === 0) return;
  drawings.clear(); equipment.items = []; connections = []; selectedDrawingIndex = -1; selectedTextIndex = -1; markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
});
document.getElementById('btnExport').addEventListener('click', exportPng);
document.getElementById('btnPrint').addEventListener('click', () => window.print());

document.getElementById('pitchView').addEventListener('change', e => { pitch.view = e.target.value; resizeCanvas(); });
document.getElementById('drawColor').addEventListener('input', e => { drawings.currentColor = e.target.value; });
document.getElementById('drawWidth').addEventListener('input', e => { drawings.currentWidth = parseFloat(e.target.value); document.getElementById('widthLabel').textContent = e.target.value; });
document.getElementById('drawOpacity').addEventListener('input', e => { drawings.currentOpacity = parseInt(e.target.value) / 100; document.getElementById('opacityLabel').textContent = e.target.value + '%'; });
document.getElementById('textSize').addEventListener('input', e => { document.getElementById('textSizeLabel').textContent = e.target.value; drawings.currentFontSize = parseInt(e.target.value); if (selectedTextIndex >= 0 && drawings.drawings[selectedTextIndex] && (drawings.drawings[selectedTextIndex].type === 'textbox' || drawings.drawings[selectedTextIndex].type === 'text')) { drawings.drawings[selectedTextIndex].fontSize = parseInt(e.target.value); markDirty(); render(); } });
document.getElementById('lineStyle').addEventListener('change', e => { drawings.currentLineStyle = e.target.value; });
document.getElementById('homeColor').addEventListener('input', e => { players.homeColor = e.target.value; render(); updateUI(); });
document.getElementById('awayColor').addEventListener('input', e => { players.awayColor = e.target.value; render(); updateUI(); });
document.getElementById('btnAddHome').addEventListener('click', () => { const dim = pitch.getViewDimensions(); players.add('home', players.countByTeam('home')+1, '', 'MID', dim.w/2+(Math.random()-0.5)*80, dim.h/2+(Math.random()-0.5)*80); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); });
document.getElementById('btnAddAway').addEventListener('click', () => { const dim = pitch.getViewDimensions(); players.add('away', players.countByTeam('away')+1, '', 'MID', dim.w/2+(Math.random()-0.5)*80, dim.h/2+(Math.random()-0.5)*80); markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); });
function deleteSelected() {
  if (players.selectedIndices.size > 0) {
    players.removeAll(players.selectedIndices); cleanupConnections();
  } else if (equipment.selectedIndices.size > 0) {
    equipment.removeAll(equipment.selectedIndices);
  } else if (selectedDrawingIndex >= 0) {
    drawings.removeAt(selectedDrawingIndex); selectedDrawingIndex = -1;
  } else if (selectedTextIndex >= 0) {
    drawings.removeAt(selectedTextIndex); selectedTextIndex = -1;
  } else return;
  markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
}
document.getElementById('btnDeletePlayer').addEventListener('click', deleteSelected);
document.getElementById('btnDuplicate').addEventListener('click', duplicateSelection);

let viewLocked = false;
document.getElementById('btnLockView').addEventListener('click', () => {
  viewLocked = !viewLocked;
  document.getElementById('btnLockView').textContent = viewLocked ? '🔒 Locked' : '🔓 Lock';
});

document.getElementById('btnClearCanvas').addEventListener('click', () => {
  if (players.players.length === 0 && drawings.drawings.length === 0 && equipment.items.length === 0) return;
  isAnimating = false; animation.clearKeyframes(); animation.stop(players.players, equipment.items);
  players.players = []; drawings.clear(); equipment.items = []; connections = [];
  selectedDrawingIndex = -1; selectedTextIndex = -1;
  history.clear(); history.push(players.players, drawings.drawings, equipment.items, connections);
  isDirty = true; markDirty();
  render(); updateUI();
});

document.getElementById('playerName').addEventListener('input', e => { if (players.selected) { players.selected.name = e.target.value; render(); updateUI(); markDirty(); } });
document.getElementById('playerNumber').addEventListener('input', e => { if (players.selected) { const n = parseInt(e.target.value); players.selected.number = isNaN(n) ? 0 : n; render(); updateUI(); } });
document.getElementById('playerTeam').addEventListener('change', e => { if (players.selected) { players.selected.team = e.target.value; render(); updateUI(); markDirty(); } });
document.getElementById('playerRole').addEventListener('change', e => { if (players.selected) { players.selected.role = e.target.value; render(); updateUI(); } });
document.getElementById('btnUploadFace').addEventListener('click', () => document.getElementById('faceFileInput').click());
document.getElementById('faceFileInput').addEventListener('change', e => {
  if (!players.selected || !e.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = ev => {
    players.selected.faceImage = ev.target.result;
    players.selected.faceZoom = parseFloat(document.getElementById('faceZoom').value) || 1;
    players.selected.faceOffsetX = parseFloat(document.getElementById('faceOffsetX').value) || 0;
    players.selected.faceOffsetY = parseFloat(document.getElementById('faceOffsetY').value) || 0;
    loadPlayerProps(); render(); markDirty();
  };
  reader.readAsDataURL(e.target.files[0]);
});
document.getElementById('btnRemoveFace').addEventListener('click', () => {
  if (!players.selected) return;
  players.selected.faceImage = '';
  loadPlayerProps(); render(); markDirty();
});
document.getElementById('faceZoom').addEventListener('input', e => {
  if (!players.selected) return;
  players.selected.faceZoom = parseFloat(e.target.value);
  document.getElementById('faceZoomLabel').textContent = parseFloat(e.target.value).toFixed(1);
  render();
});
document.getElementById('faceOffsetX').addEventListener('input', e => {
  if (!players.selected) return;
  players.selected.faceOffsetX = parseFloat(e.target.value);
  render();
});
document.getElementById('faceOffsetY').addEventListener('input', e => {
  if (!players.selected) return;
  players.selected.faceOffsetY = parseFloat(e.target.value);
  render();
});
document.getElementById('playerSearch').addEventListener('input', e => { searchTerm = e.target.value; updateUI(); });

document.getElementById('pitchStyle').addEventListener('change', e => { pitch.style = e.target.value; render(); });
document.getElementById('pitchLineColor').addEventListener('input', e => { pitch.lineColor = e.target.value; render(); });
document.getElementById('chkBench').addEventListener('change', e => { pitch.showBench = e.target.checked; resizeCanvas(); });
document.getElementById('chkGrid').addEventListener('change', e => { gridEnabled = e.target.checked; render(); });
document.getElementById('chkSnap').addEventListener('change', e => { snapEnabled = e.target.checked; });
document.getElementById('chkLabels').addEventListener('change', e => { showLabels = e.target.checked; render(); });
document.getElementById('btnTogglePanel').addEventListener('click', () => {
  const panel = document.getElementById('panel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
  document.getElementById('btnTogglePanel').classList.toggle('active');
  setTimeout(resizeCanvas, 100);
});

document.getElementById('btnResetView').addEventListener('click', () => {
  zoom = 1; panX = 0; panY = 0;
  document.getElementById('zoomLabel').textContent = '100%';
  resizeCanvas();
});

document.getElementById('btnFullscreen').addEventListener('click', () => {
  const wrap = document.getElementById('canvasWrap');
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
  if (!fsEl) {
    const fn = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    fn.call(wrap).catch(() => {});
  } else {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    fn.call(document).catch(() => {});
  }
});

function onFullscreenChange() {
  const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
  document.getElementById('btnFullscreen').textContent = isFS ? '✕ Exit' : '⛶ Full';
  resizeCanvas();
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

document.querySelectorAll('.eq-btn[data-eq]').forEach(btn => {
  btn.addEventListener('click', () => {
    const dim = pitch.getViewDimensions();
    const sz = parseFloat(document.getElementById('equipSize').value);
    equipment.add(btn.dataset.eq, dim.w/2, dim.h/2, sz);
    equipment.selectedIndices.add(equipment.items.length - 1);
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI();
  });
});

document.querySelectorAll('[data-formation]').forEach(btn => {
  btn.addEventListener('click', () => {
    const data = FORMATION_DATA[btn.dataset.formation];
    if (!data) return;
    isAnimating = false; animation.clearKeyframes(); animation.stop(players.players, equipment.items);
    drawings.clear(); equipment.items = []; connections = []; selectedDrawingIndex = -1; selectedTextIndex = -1; players.applyFormation(data);
    history.clear(); history.push(players.players, drawings.drawings, equipment.items, connections);
    document.querySelectorAll('[data-formation]').forEach(b => b.classList.remove('active-formation'));
    btn.classList.add('active-formation');
    markDirty(); render(); updateUI(); updateTimeline();
  });
});

// Equipment size slider
document.getElementById('equipSize').addEventListener('input', () => {
  const val = parseFloat(document.getElementById('equipSize').value);
  document.getElementById('equipSizeVal').textContent = val;
  if (equipment.selectedIndices.size > 0) {
    for (const si of equipment.selectedIndices) {
      equipment.items[si].size = val;
    }
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render();
  }
});

document.getElementById('equipRot').addEventListener('input', () => {
  const deg = parseFloat(document.getElementById('equipRot').value);
  document.getElementById('equipRotVal').textContent = deg + '°';
  if (equipment.selectedIndices.size > 0) {
    const rad = deg * Math.PI / 180;
    for (const si of equipment.selectedIndices) {
      equipment.items[si].rotation = rad;
    }
    markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render();
  }
});

// ---- Animation Controls ----
document.getElementById('tlPlay').addEventListener('click', () => {
  if (animation.isPlaying) {
    animation.pause();
    updateTimeline();
  } else {
    isAnimating = true;
    players.selectedIndices.clear();
    equipment.selectedIndices.clear();
    animation.play(players.players, equipment.items);
    updateTimeline(); render(); updateUI();
  }
});

document.getElementById('tlStop').addEventListener('click', () => {
  isAnimating = false;
  animation.stop(players.players, equipment.items);
  updateTimeline(); render(); updateUI();
});

document.getElementById('tlAddKey').addEventListener('click', () => {
  animation.addKeyframe(players.players, equipment.items);
  updateTimeline();
});

document.getElementById('tlClearKeys').addEventListener('click', () => {
  animation.clearKeyframes();
  animation.stop(players.players, equipment.items);
  isAnimating = false;
  updateTimeline(); render(); updateUI();
});

document.getElementById('tlTrack').addEventListener('click', onTimelineSeek);
document.getElementById('tlTrack').addEventListener('mousedown', (e) => {
  if (!animation.isPlaying) {
    const onMove = (ev) => { onTimelineSeek(ev); };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    onTimelineSeek(e);
  }
});

document.getElementById('tlSpeed').addEventListener('change', (e) => {
  animation.speed = parseFloat(e.target.value);
});

document.getElementById('tlLoop').addEventListener('change', (e) => {
  animation.loop = e.target.checked;
});

// Animation frame callback
animation.onFrame = (time, kfIndex) => {
  updateTimeline();
  render();
};

// ---- Video/GIF Export ----
async function exportVideo() {
  if (animation.keyframes.length < 2) return;

  const format = document.getElementById('exportFormat').value;
  const fps = parseInt(document.getElementById('exportFps').value);
  const speed = parseFloat(document.getElementById('tlSpeed').value);
  const dur = animation.totalDuration;

  // Save original positions
  const origPositions = players.players.map(p => ({ x: p.x, y: p.y, direction: p.direction, visible: p.visible }));
  const origEquip = equipment.items.map(e => ({ x: e.x, y: e.y, size: e.size || 1, rotation: e.rotation || 0 }));

  function restoreState() {
    animation.stop(players.players, equipment.items);
    animation.restoreSnapshot(players.players, origPositions);
    if (origEquip) {
      equipment.items.forEach((eq, i) => {
        if (origEquip[i]) { eq.x = origEquip[i].x; eq.y = origEquip[i].y; eq.size = origEquip[i].size; eq.rotation = origEquip[i].rotation; }
      });
    }
    render();
    animation.onFrame = null;
  }

  if (format === 'webm') {
    await exportVideoWebM(fps, speed, dur, restoreState);
  } else {
    await exportVideoGIF(fps, speed, dur, restoreState);
  }
}

async function exportVideoWebM(fps, speed, dur, restoreState) {
  // Save current canvas state
  const origW = canvas.width, origH = canvas.height;
  const origSW = canvas.style.width, origSH = canvas.style.height;
  const origScale = canvasScale, origOx = pitchOffsetX, origOy = pitchOffsetY;

  // Upsize canvas buffer to 1920p (keep CSS size same)
  const dim = pitch.getViewDimensions();
  const newW = 1920;
  const newH = Math.round(newW * dim.h / dim.w);
  canvas.width = newW;
  canvas.height = newH;
  canvasScale = newW / dim.w;
  pitchOffsetX = 0;
  pitchOffsetY = 0;

  // Render first frame
  const pos0 = animation.getPositionsAt(0);
  animation.restoreSnapshot(players.players, pos0.players);
  if (equipment.items) animation.restoreEquipSnapshot(equipment.items, pos0.equipment);
  render();

  const stream = canvas.captureStream(fps);
  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  let mimeType = mimeTypes.find(mt => MediaRecorder.isTypeSupported(mt)) || '';
  const opts = {};
  if (mimeType) opts.mimeType = mimeType;
  const recorder = new MediaRecorder(stream, opts);
  const chunks = [];

  return new Promise(resolve => {
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      restoreState();
      // Restore canvas
      canvas.width = origW; canvas.height = origH;
      canvas.style.width = origSW; canvas.style.height = origSH;
      canvasScale = origScale; pitchOffsetX = origOx; pitchOffsetY = origOy;
      render();
      saveVideoBlob(blob, 'tactics-animation.webm');
      resolve();
    };

    recorder.start();
    animation.speed = speed;
    animation.play(players.players, equipment.items);

    animation.onFrame = () => {
      render();
      if (animation.currentTime >= dur - 0.01) {
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 300);
      }
    };
  });
}

async function exportVideoGIF(fps, speed, dur, restoreState) {
  const dim = pitch.getViewDimensions();
  const exportW = 1920;
  const exportH = Math.round(exportW * dim.h / dim.w);
  const exportScale = exportW / dim.w;
  const totalFrames = Math.ceil((dur / speed) * fps);
  const frameInterval = 1000 / fps;

  const offscreen = document.createElement('canvas');
  offscreen.width = exportW;
  offscreen.height = exportH;
  const offCtx = offscreen.getContext('2d');

  const encoder = new GIFEncoder(exportW, exportH, true);
  encoder.setDelay(Math.round(frameInterval));
  encoder.setRepeat(0);

  for (let f = 0; f <= totalFrames; f++) {
    const time = Math.min((f / totalFrames) * dur, dur);
    const pos = animation.getPositionsAt(time);
    animation.restoreSnapshot(players.players, pos.players);
    if (equipment.items) animation.restoreEquipSnapshot(equipment.items, pos.equipment);
    renderToContext(offCtx, exportScale, 0, 0);
    await new Promise(r => setTimeout(r, 0));
    encoder.addFrame(offCtx);
    if (f % 10 === 0) {
      document.getElementById('btnExportVideo').textContent = 'Rendering ' + Math.round(f / totalFrames * 100) + '%';
    }
  }

  restoreState();
  document.getElementById('btnExportVideo').textContent = 'Export';

  const blob = await new Promise(resolve => {
    setTimeout(() => {
      const gifBlob = encoder.render();
      resolve(gifBlob);
    }, 50);
  });

  saveVideoBlob(blob, 'tactics-animation.gif');
}

async function fallbackGIFExport(fps, speed, dur, restoreState) {
  document.getElementById('btnExportVideo').textContent = 'Export GIF...';
  await exportVideoGIF(fps, speed, dur, restoreState);
}

function saveVideoBlob(blob, filename) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    if (window.electronAPI) {
      window.electronAPI.saveVideo(dataUrl, filename);
    } else {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    }
  };
  reader.readAsDataURL(blob);
}

document.getElementById('btnExportVideo').addEventListener('click', exportVideo);

// ---- Electron IPC ----
if (window.electronAPI) {
  window.electronAPI.onMenuNew(() => { isAnimating = false; animation.clearKeyframes(); animation.stop(players.players, equipment.items); players.players = []; drawings.clear(); equipment.items = []; connections = []; selectedDrawingIndex = -1; selectedTextIndex = -1; history.clear(); isDirty = false; cleanTitle = 'Untitled'; document.title = 'TacticalPad - Untitled'; render(); updateUI(); updateTimeline(); document.getElementById('statusFile').textContent = 'Untitled'; });

  window.electronAPI.onMenuClearDrawings(() => { isAnimating = false; animation.stop(players.players, equipment.items); drawings.clear(); equipment.items = []; selectedDrawingIndex = -1; selectedTextIndex = -1; markDirty(); history.push(players.players, drawings.drawings, equipment.items, connections); render(); updateUI(); });
  window.electronAPI.onMenuResetPlayers(() => { isAnimating = false; animation.stop(players.players, equipment.items); players.players = []; connections = []; render(); updateUI(); });
  window.electronAPI.onMenuView((v) => { pitch.view = v; document.getElementById('pitchView').value = v; resizeCanvas(); });
  window.electronAPI.onMenuZoomIn(() => { zoom = Math.min(3, zoom + 0.2); document.getElementById('zoomLabel').textContent = Math.round(zoom*100)+'%'; resizeCanvas(); });
  window.electronAPI.onMenuZoomOut(() => { zoom = Math.max(0.3, zoom - 0.2); document.getElementById('zoomLabel').textContent = Math.round(zoom*100)+'%'; resizeCanvas(); });
  window.electronAPI.onMenuZoomReset(() => { zoom = 1; panX = 0; panY = 0; document.getElementById('zoomLabel').textContent = '100%'; resizeCanvas(); });
  window.electronAPI.onMenuToggleGrid(() => { gridEnabled = !gridEnabled; document.getElementById('chkGrid').checked = gridEnabled; render(); });
  window.electronAPI.onMenuPrint(() => { window.print(); });
  window.electronAPI.onSaveDone((data) => { isDirty = false; cleanTitle = data.basename; document.getElementById('statusFile').textContent = data.basename; document.title = 'TacticalPad - ' + data.basename; });
  window.electronAPI.onSaveAsDone((data) => { isDirty = false; cleanTitle = data.basename; document.getElementById('statusFile').textContent = data.basename; document.title = 'TacticalPad - ' + data.basename; });
}

// ---- Init ----
startAutoBackup();
try {
  resizeCanvas();
  players.applyFormation(FORMATION_DATA['4-3-3']);
  history.clear();
  history.push(players.players, drawings.drawings, equipment.items, connections);
  render();
  updateUI();
  updateTimeline();
  setTool('select');
} catch (initErr) {
  console.error('Init error:', initErr);
  document.getElementById('canvasWrap').innerHTML += '<div style="color:#e94560;padding:20px;text-align:center;font-size:14px">Error loading: ' + initErr.message + '</div>';
}

window.addEventListener('error', function(e) {
  console.error('Global error:', e.error || e.message);
  const errMsg = e.error ? e.error.message : e.message;
  if (document.getElementById('globalErrorBar')) return;
  const el = document.createElement('div');
  el.id = 'globalErrorBar';
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#e94560;color:#fff;padding:10px 16px;font-size:14px;font-weight:bold;z-index:99999;text-align:center';
  el.textContent = 'Error: ' + errMsg;
  document.body.appendChild(el);
});
