import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

// Set up DOM for app.js helpers
const html = fs.readFileSync('src/index.html', 'utf-8');
document.body.innerHTML = html;

// We can't easily import app.js since it runs on load, but we can test
// individual functions by evaluating them with their dependencies.

// Load dependencies
const formationCode = fs.readFileSync('src/js/formations.js', 'utf-8');
const pitchCode = fs.readFileSync('src/js/pitch.js', 'utf-8');
const playersCode = fs.readFileSync('src/js/players.js', 'utf-8');
const drawingsCode = fs.readFileSync('src/js/drawings.js', 'utf-8');
const equipmentCode = fs.readFileSync('src/js/equipment.js', 'utf-8');
const historyCode = fs.readFileSync('src/js/history.js', 'utf-8');

// Polyfills
if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => 'test-uuid';
globalThis.Image = class Image {
  constructor() { this.complete = false; this.naturalWidth = 0; }
};

// Set up canvas for coordinate helpers
const canvas = document.getElementById('pitchCanvas');
canvas.width = 800;
canvas.height = 600;
canvas.style.width = '800px';
canvas.style.height = '600px';
Object.defineProperty(canvas, 'offsetWidth', { value: 800, configurable: true });
Object.defineProperty(canvas, 'offsetHeight', { value: 600, configurable: true });

eval(formationCode);
eval(pitchCode + '\nglobalThis.PitchRenderer = PitchRenderer;');
eval(historyCode + '\nglobalThis.HistoryManager = HistoryManager;');
eval(playersCode + '\nglobalThis.PlayerManager = PlayerManager;');
eval(drawingsCode + '\nglobalThis.DrawingEngine = DrawingEngine;');
eval(equipmentCode + '\nglobalThis.EquipmentManager = EquipmentManager;');

// Define globals that app.js depends on
// We manually define the functions we want to test
const pitch = new PitchRenderer();
const players = new PlayerManager();
const drawings = new DrawingEngine();
const equipment = new EquipmentManager();
const history = new HistoryManager();

let zoom = 1;
let panX = 0, panY = 0;
let pitchOffsetX = 0, pitchOffsetY = 0;
let canvasScale = 1;
let snapEnabled = false;
let gridEnabled = false;
let showLabels = true;
let currentTool = 'select';
let selectedDrawingIndex = -1;
let selectedTextIndex = -1;
let viewLocked = false;

// ---- Functions from app.js ----
function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  const dim = pitch.getViewDimensions();
  const aspect = dim.w / dim.h;
  let w = 800, h = 600;
  const dpr = 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvasScale = (w / dim.w) * dpr * zoom;
  pitchOffsetX = panX;
  pitchOffsetY = panY;
}

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

function setTool(tool) {
  currentTool = tool;
}

function deleteSelected() {
  let deleted = false;
  if (players.selectedIndices.size > 0) {
    players.removeAll(players.selectedIndices);
    deleted = true;
  } else if (equipment.selectedIndices.size > 0) {
    equipment.removeAll(equipment.selectedIndices);
    deleted = true;
  } else if (selectedDrawingIndex >= 0) {
    drawings.removeAt(selectedDrawingIndex);
    selectedDrawingIndex = -1;
    deleted = true;
  } else if (selectedTextIndex >= 0) {
    drawings.removeAt(selectedTextIndex);
    selectedTextIndex = -1;
    deleted = true;
  }
  return deleted;
}

resizeCanvas();

describe('app.js helpers', () => {
  describe('snapToGrid', () => {
    it('returns original coords when snap is disabled', () => {
      snapEnabled = false;
      const result = snapToGrid(123, 456);
      expect(result).toEqual({ x: 123, y: 456 });
    });

    it('snaps to grid when enabled', () => {
      snapEnabled = true;
      const dim = pitch.getViewDimensions();
      const gridX = dim.w / 12;
      const result = snapToGrid(100, 100);
      expect(result.x % gridX).toBe(0);
      expect(result.y % (dim.h / 14)).toBe(0);
    });
  });

  describe('getDevCoords', () => {
    it('converts client coords to device coords', () => {
      const r = canvas.getBoundingClientRect();
      const result = getDevCoords({ clientX: r.left + 100, clientY: r.top + 50 });
      expect(result.x).toBeCloseTo(100, 1);
      expect(result.y).toBeCloseTo(50, 1);
    });
  });

  describe('getCanvasCoords', () => {
    it('converts client coords to pitch coordinates', () => {
      const dim = pitch.getViewDimensions();
      const r = canvas.getBoundingClientRect();
      const result = getCanvasCoords({ clientX: r.left + 400, clientY: r.top + 300 });
      expect(result.x).toBeCloseTo(dim.w / 2, 0);
    });
  });

  describe('resizeCanvas / coordinate transform', () => {
    it('panX/Y offset is reflected in getCanvasCoords', () => {
      zoom = 1; panX = 100; panY = 50;
      resizeCanvas();
      const r = canvas.getBoundingClientRect();
      const result = getCanvasCoords({ clientX: r.left, clientY: r.top });
      expect(result.x).toBeLessThan(0);
      expect(result.y).toBeLessThan(0);
      // Reset
      panX = 0; panY = 0;
      resizeCanvas();
    });

    it('zoom changes scale mapping', () => {
      const r = canvas.getBoundingClientRect();
      zoom = 2;
      resizeCanvas();
      // At zoom 2, a dev coord difference of 2 means 1 pitch unit
      const result = getCanvasCoords({ clientX: r.left + 200, clientY: r.top + 100 });
      const result2 = getCanvasCoords({ clientX: r.left + 202, clientY: r.top + 102 });
      expect(result2.x - result.x).toBeCloseTo(1, 0);
      zoom = 1;
      resizeCanvas();
    });
  });
});

describe('setTool', () => {
  it('sets the current tool', () => {
    setTool('pen');
    expect(currentTool).toBe('pen');
    setTool('select');
    expect(currentTool).toBe('select');
  });
});

describe('PlayerManager integration', () => {
  beforeEach(() => {
    players.players = [];
  });

  it('selected getter returns last selected player', () => {
    players.add('home', 1, 'A', 'MID', 0, 0);
    players.add('home', 2, 'B', 'DEF', 10, 10);
    players.select(1);
    expect(players.selected.name).toBe('B');
  });

  it('players can be found by canvas position with scale', () => {
    players.add('home', 1, '', '', 100, 100);
    const idx = players.findByCanvasPos(100, 100, 1);
    expect(idx).toBe(0);
  });
});

describe('deleteSelected integration', () => {
  beforeEach(() => {
    players.players = [];
    equipment.items = [];
    drawings.clear();
    selectedDrawingIndex = -1;
    selectedTextIndex = -1;
  });

  it('deletes selected players', () => {
    players.add('home', 1);
    players.add('home', 2);
    players.select(0);
    const result = deleteSelected();
    expect(result).toBe(true);
    expect(players.count()).toBe(1);
  });

  it('deletes selected equipment', () => {
    equipment.add('cone', 0, 0);
    equipment.add('ball', 10, 10);
    equipment.select(1);
    const result = deleteSelected();
    expect(result).toBe(true);
    expect(equipment.items).toHaveLength(1);
  });

  it('deletes selected drawing by index', () => {
    drawings.drawings.push({ type: 'line', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: '#fff' });
    selectedDrawingIndex = 0;
    const result = deleteSelected();
    expect(result).toBe(true);
    expect(drawings.drawings).toHaveLength(0);
    expect(selectedDrawingIndex).toBe(-1);
  });

  it('returns false when nothing selected', () => {
    const result = deleteSelected();
    expect(result).toBe(false);
  });
});

describe('DrawingEngine integration', () => {
  it('full pen stroke lifecycle', () => {
    drawings.startStroke('pen', 10, 10, '#ff0000', 2);
    drawings.continueStroke('pen', 20, 20);
    drawings.continueStroke('pen', 30, 30);
    const result = drawings.endStroke('pen', 30, 30);
    expect(result).not.toBeNull();
    expect(drawings.drawings).toHaveLength(1);
    expect(drawings.isDrawing).toBe(false);
  });

  it('full arrow stroke lifecycle', () => {
    drawings.startStroke('arrow', 0, 0, '#fff', 1);
    const result = drawings.endStroke('arrow', 100, 100);
    expect(result.type).toBe('arrow');
    expect(result.points).toHaveLength(2);
  });
});

describe('HistoryManager integration', () => {
  it('push and undo restores previous state', () => {
    const p = [{ id: 1 }];
    history.push(p, [], [], []);
    p[0].id = 2;
    history.push(p, [], [], []);
    const snap = history.undo();
    expect(snap.players[0].id).toBe(1);
  });

  it('history respects maxSteps', () => {
    const hm2 = new HistoryManager(2);
    for (let i = 0; i < 5; i++) {
      hm2.push([{ n: i }], [], [], []);
    }
    expect(hm2.stack.length).toBe(2);
    expect(hm2.stack[0].players[0].n).toBe(3);
    expect(hm2.stack[1].players[0].n).toBe(4);
  });
});
