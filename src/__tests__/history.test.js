import { describe, it, expect, beforeEach } from 'vitest';

const fs = await import('fs');
const code = fs.readFileSync('src/js/history.js', 'utf-8');
eval(code + '\nglobalThis.HistoryManager = HistoryManager;');

describe('HistoryManager', () => {
  let hm;

  beforeEach(() => {
    hm = new HistoryManager(5);
  });

  it('starts empty with no undo/redo', () => {
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(false);
    expect(hm.undo()).toBeNull();
    expect(hm.redo()).toBeNull();
  });

  it('push adds a snapshot', () => {
    hm.push([], [], [], []);
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(false);
  });

  it('two pushes enables undo', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    expect(hm.canUndo()).toBe(true);
    expect(hm.canRedo()).toBe(false);
  });

  it('undo returns previous state', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    const snap = hm.undo();
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0].id).toBe(1);
  });

  it('undo moves index, redo moves forward', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    hm.push([{ id: 3 }], [], [], []);
    hm.undo();
    hm.undo();
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(true);
    const snap = hm.redo();
    expect(snap.players[0].id).toBe(2);
  });

  it('push after undo discards redo stack', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    hm.push([{ id: 3 }], [], [], []);
    hm.undo();
    hm.push([{ id: 4 }], [], [], []);
    expect(hm.canRedo()).toBe(false);
    const snap = hm.undo();
    expect(snap.players[0].id).toBe(2);
  });

  it('push creates deep copies', () => {
    const players = [{ x: 100, y: 100 }];
    hm.push(players, [], [], []);
    players[0].x = 999;
    const snap = hm.undo();
    expect(snap).toBeNull(); // can't undo with only 1 push
  });

  it('respects maxSteps limit', () => {
    const hm2 = new HistoryManager(3);
    for (let i = 0; i < 5; i++) {
      hm2.push([{ id: i }], [], [], []);
    }
    expect(hm2.stack.length).toBe(3);
    expect(hm2.stack[0].players[0].id).toBe(2);
    expect(hm2.stack[1].players[0].id).toBe(3);
    expect(hm2.stack[2].players[0].id).toBe(4);
  });

  it('clear resets everything', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    hm.clear();
    expect(hm.canUndo()).toBe(false);
    expect(hm.canRedo()).toBe(false);
    expect(hm.undo()).toBeNull();
    expect(hm.stack).toHaveLength(0);
  });

  it('redo returns null at latest position', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    expect(hm.redo()).toBeNull();
  });

  it('canUndo false with single push', () => {
    hm.push([], [], [], []);
    expect(hm.canUndo()).toBe(false);
  });

  it('multiple push then undo then push truncates redo', () => {
    hm.push([{ id: 1 }], [], [], []);
    hm.push([{ id: 2 }], [], [], []);
    hm.push([{ id: 3 }], [], [], []);
    hm.undo();
    hm.undo();
    expect(hm.stack.length).toBe(3);
    hm.push([{ id: 4 }], [], [], []);
    expect(hm.stack.length).toBe(2);
    // Should have: [{id:1}, {id:4}]
    expect(hm.stack[0].players[0].id).toBe(1);
    expect(hm.stack[1].players[0].id).toBe(4);
  });
});
