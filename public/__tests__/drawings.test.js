import { describe, it, expect, beforeEach } from 'vitest';

const fs = await import('fs');
const code = fs.readFileSync('src/js/drawings.js', 'utf-8');
eval(code + '\nglobalThis.DrawingEngine = DrawingEngine;');

describe('DrawingEngine', () => {
  let de;

  beforeEach(() => {
    de = new DrawingEngine();
  });

  it('starts empty', () => {
    expect(de.drawings).toHaveLength(0);
    expect(de.isDrawing).toBe(false);
  });

  it('startStroke initializes state for pen', () => {
    de.startStroke('pen', 10, 20, '#ff0000', 3);
    expect(de.isDrawing).toBe(true);
    expect(de.drawStart).toEqual({ x: 10, y: 20 });
    expect(de.points).toEqual([{ x: 10, y: 20 }]);
    expect(de.currentColor).toBe('#ff0000');
    expect(de.currentWidth).toBe(3);
    expect(de.tempDrawing).not.toBeNull();
    expect(de.tempDrawing.type).toBe('pen');
  });

  it('startStroke initializes for non-pen without tempDrawing', () => {
    de.startStroke('arrow', 5, 15, '#00ff00', 2);
    expect(de.isDrawing).toBe(true);
    expect(de.tempDrawing).toBeNull();
  });

  it('continueStroke appends points', () => {
    de.startStroke('pen', 0, 0);
    de.continueStroke('pen', 10, 10);
    de.continueStroke('pen', 20, 20);
    expect(de.points).toHaveLength(3);
    expect(de.points[2]).toEqual({ x: 20, y: 20 });
  });

  it('continueStroke updates tempDrawing for pen', () => {
    de.startStroke('pen', 0, 0);
    de.continueStroke('pen', 10, 10);
    expect(de.tempDrawing.points).toHaveLength(2);
  });

  it('endStroke returns null when not drawing', () => {
    const result = de.endStroke('pen', 0, 0);
    expect(result).toBeNull();
  });

  it('endStroke creates a pen drawing with multiple points', () => {
    de.startStroke('pen', 0, 0, '#fff', 2);
    de.continueStroke('pen', 10, 10);
    de.continueStroke('pen', 20, 20);
    const result = de.endStroke('pen', 20, 20);
    expect(result).not.toBeNull();
    expect(result.type).toBe('pen');
    expect(result.color).toBe('#fff');
    expect(result.width).toBe(2);
    expect(result.points).toHaveLength(3);
    expect(de.drawings).toHaveLength(1);
  });

  it('endStroke does not create pen with single point', () => {
    de.startStroke('pen', 0, 0);
    const result = de.endStroke('pen', 0, 0);
    expect(result).toBeNull();
    expect(de.drawings).toHaveLength(0);
  });

  it('endStroke creates a line drawing', () => {
    de.startStroke('line', 10, 20);
    const result = de.endStroke('line', 50, 60);
    expect(result.type).toBe('line');
    expect(result.points).toEqual([{ x: 10, y: 20 }, { x: 50, y: 60 }]);
  });

  it('endStroke creates an arrow drawing', () => {
    de.startStroke('arrow', 0, 0);
    const result = de.endStroke('arrow', 100, 100);
    expect(result.type).toBe('arrow');
    expect(result.points).toHaveLength(2);
  });

  it('endStroke creates a dashed arrow', () => {
    de.startStroke('dashed', 0, 0);
    const result = de.endStroke('dashed', 50, 50);
    expect(result.type).toBe('arrow');
    expect(result.lineStyle).toBe('dashed');
  });

  it('endStroke creates a rect drawing', () => {
    de.startStroke('rect', 10, 10);
    const result = de.endStroke('rect', 100, 100);
    expect(result.type).toBe('rect');
    expect(result.fill).toBe(true);
  });

  it('endStroke rejects tiny rect', () => {
    de.startStroke('rect', 100, 100);
    const result = de.endStroke('rect', 101, 101);
    expect(result).toBeNull();
  });

  it('endStroke creates a circle drawing', () => {
    de.startStroke('circle', 0, 0);
    const result = de.endStroke('circle', 50, 50);
    expect(result.type).toBe('circle');
    expect(result.fill).toBe(true);
  });

  it('endStroke rejects tiny circle', () => {
    de.startStroke('circle', 100, 100);
    const result = de.endStroke('circle', 100.5, 100.5);
    expect(result).toBeNull();
  });

  it('endStroke creates a textbox', () => {
    de.startStroke('textbox', 0, 0);
    const result = de.endStroke('textbox', 100, 50);
    expect(result.type).toBe('textbox');
    expect(result.text).toBe('Text');
  });

  it('clear removes all drawings', () => {
    de.startStroke('line', 0, 0);
    de.endStroke('line', 10, 10);
    de.startStroke('line', 5, 5);
    de.endStroke('line', 15, 15);
    expect(de.drawings).toHaveLength(2);
    de.clear();
    expect(de.drawings).toHaveLength(0);
  });

  it('removeAt removes drawing at index', () => {
    de.startStroke('line', 0, 0);
    de.endStroke('line', 10, 10);
    de.startStroke('line', 5, 5);
    de.endStroke('line', 15, 15);
    const result = de.removeAt(0);
    expect(result).toBe(true);
    expect(de.drawings).toHaveLength(1);
  });

  it('removeAt returns false for invalid index', () => {
    expect(de.removeAt(-1)).toBe(false);
    expect(de.removeAt(0)).toBe(false);
  });

  it('bringToFront moves drawing to end', () => {
    de.startStroke('line', 0, 0);
    de.endStroke('line', 10, 10);
    de.startStroke('line', 5, 5);
    de.endStroke('line', 15, 15);
    de.bringToFront(0);
    expect(de.drawings[1].points[0]).toEqual({ x: 0, y: 0 });
  });

  it('sendToBack moves drawing to front', () => {
    de.startStroke('line', 0, 0);
    de.endStroke('line', 10, 10);
    de.startStroke('line', 5, 5);
    de.endStroke('line', 15, 15);
    de.sendToBack(1);
    expect(de.drawings[0].points[0]).toEqual({ x: 5, y: 5 });
  });

  it('hitTest finds a line drawing near its segment', () => {
    de.startStroke('line', 0, 0);
    de.endStroke('line', 100, 100);
    // hit at midpoint of line with scale=1 (r = 12*1 = 12)
    const idx = de.hitTest(50, 50, 1);
    expect(idx).toBe(0);
  });

  it('hitTest returns -1 when far from any drawing', () => {
    de.startStroke('line', 0, 0);
    de.endStroke('line', 10, 10);
    const idx = de.hitTest(500, 500, 1);
    expect(idx).toBe(-1);
  });

  it('hitTest finds a rect drawing', () => {
    de.startStroke('rect', 10, 10);
    de.endStroke('rect', 100, 100);
    // Inside rect with scale=1
    const idx = de.hitTest(50, 50, 1);
    expect(idx).toBe(0);
  });

  it('hitTest finds a text drawing', () => {
    de.drawings.push({ type: 'text', x: 100, y: 100, color: '#fff', opacity: 1 });
    // within 50*scale = 50px of x, 20*scale = 20px of y
    const idx = de.hitTest(120, 110, 1);
    expect(idx).toBe(0);
  });

  it('hitTestText matches text type', () => {
    de.drawings.push({ type: 'text', x: 100, y: 100, color: '#fff', opacity: 1 });
    const idx = de.hitTestText(110, 105, 1);
    expect(idx).toBe(0);
  });

  it('hitTestText does not match far from text', () => {
    de.drawings.push({ type: 'text', x: 100, y: 100, color: '#fff', opacity: 1 });
    const idx = de.hitTestText(200, 200, 1);
    expect(idx).toBe(-1);
  });

  it('hitTestText finds textbox type', () => {
    de.drawings.push({ type: 'textbox', points: [{ x: 50, y: 50 }, { x: 150, y: 100 }], color: '#fff' });
    const idx = de.hitTestText(100, 75, 1);
    expect(idx).toBe(0);
  });

  it('hitTestText ignores non-text types', () => {
    de.drawings.push({ type: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#fff' });
    const idx = de.hitTestText(5, 5, 1);
    expect(idx).toBe(-1);
  });

  it('getBounds returns null for drawing with fewer than 2 points', () => {
    const d = { type: 'line', points: [{ x: 0, y: 0 }] };
    expect(de.getBounds(d)).toBeNull();
  });

  it('getBounds returns bounds for text type', () => {
    const d = { type: 'text', x: 100, y: 100 };
    const bounds = de.getBounds(d);
    expect(bounds).toBeTruthy();
    expect(bounds.x).toBe(98);
    expect(bounds.y).toBe(98);
  });

  it('getBounds returns bounds for two-point shape', () => {
    const d = { type: 'line', points: [{ x: 10, y: 20 }, { x: 100, y: 200 }] };
    const bounds = de.getBounds(d);
    expect(bounds).toEqual({ x: 10, y: 20, w: 90, h: 180 });
  });

  it('getBounds returns bounds for pen (multiple points)', () => {
    const d = { type: 'pen', points: [{ x: 5, y: 5 }, { x: 15, y: 15 }, { x: 10, y: 20 }] };
    const bounds = de.getBounds(d);
    expect(bounds.x).toBe(5);
    expect(bounds.y).toBe(5);
    expect(bounds.w).toBe(10);
    expect(bounds.h).toBe(15);
  });

  it('setLineStyle sets dashed array for dashed', () => {
    const ctx = { setLineDash: (arr) => { ctx._dash = arr; }, _dash: [] };
    de.setLineStyle(ctx, 2, 'dashed');
    expect(ctx._dash).toEqual([8, 5]);
  });

  it('setLineStyle sets dotted array for dotted', () => {
    const ctx = { setLineDash: (arr) => { ctx._dash = arr; }, _dash: [] };
    de.setLineStyle(ctx, 2, 'dotted');
    expect(ctx._dash).toEqual([2, 4]);
  });

  it('setLineStyle clears dash for solid', () => {
    const ctx = { setLineDash: (arr) => { ctx._dash = arr; }, _dash: [8, 5] };
    de.setLineStyle(ctx, 2, 'solid');
    expect(ctx._dash).toEqual([]);
  });
});
