import { describe, it, expect, beforeEach } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => 'test-uuid';
globalThis.Image = class Image {
  constructor() { this.complete = false; this.naturalWidth = 0; }
};

const fs = await import('fs');
const code = fs.readFileSync('src/js/players.js', 'utf-8');
eval(code + '\nglobalThis.PlayerManager = PlayerManager;');

describe('PlayerManager', () => {
  let pm;

  beforeEach(() => {
    pm = new PlayerManager();
  });

  it('starts empty', () => {
    expect(pm.players).toHaveLength(0);
    expect(pm.count()).toBe(0);
    expect(pm.selected).toBeNull();
    expect(pm.lastSelectedIndex).toBe(-1);
  });

  it('adds a player', () => {
    const p = pm.add('home', 1, 'Player 1', 'MID', 100, 200);
    expect(p.team).toBe('home');
    expect(p.number).toBe(1);
    expect(p.name).toBe('Player 1');
    expect(p.role).toBe('MID');
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(pm.count()).toBe(1);
  });

  it('creates a player without adding', () => {
    const p = pm.create('away', 2, 'Test', 'DEF', 50, 60);
    expect(p.team).toBe('away');
    expect(p.number).toBe(2);
    expect(pm.count()).toBe(0);
  });

  it('removes a player by index', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.remove(0);
    expect(pm.count()).toBe(1);
    expect(pm.players[0].number).toBe(2);
  });

  it('removes all selected players', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.add('home', 3);
    pm.selectedIndices = new Set([0, 2]);
    pm.removeAll(pm.selectedIndices);
    expect(pm.count()).toBe(1);
    expect(pm.players[0].number).toBe(2);
  });

  it('does nothing when removing invalid index', () => {
    pm.add('home', 1);
    pm.remove(-1);
    pm.remove(5);
    expect(pm.count()).toBe(1);
  });

  it('selects a single player', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.select(1);
    expect(pm.selectedIndices.has(1)).toBe(true);
    expect(pm.selectedIndices.size).toBe(1);
    expect(pm.selected).toBe(pm.players[1]);
    expect(pm.lastSelectedIndex).toBe(1);
  });

  it('selects all players', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.add('away', 1);
    pm.selectAll();
    expect(pm.selectedIndices.size).toBe(3);
  });

  it('toggles selection', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.toggleSelect(0);
    expect(pm.selectedIndices.has(0)).toBe(true);
    pm.toggleSelect(0);
    expect(pm.selectedIndices.has(0)).toBe(false);
  });

  it('select() clears previous selection', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.select(0);
    pm.select(1);
    expect(pm.selectedIndices.has(0)).toBe(false);
    expect(pm.selectedIndices.has(1)).toBe(true);
  });

  it('selectInRect finds players within bounds', () => {
    pm.add('home', 1, '', '', 100, 100);
    pm.add('home', 2, '', '', 200, 200);
    pm.add('home', 3, '', '', 300, 300);
    pm.selectInRect(50, 50, 150, 150);
    expect(pm.selectedIndices.size).toBe(1);
    expect(pm.selectedIndices.has(0)).toBe(true);
  });

  it('selectInRect handles reversed coordinates', () => {
    pm.add('home', 1, '', '', 100, 100);
    pm.selectInRect(150, 150, 50, 50);
    expect(pm.selectedIndices.has(0)).toBe(true);
  });

  it('findByCanvasPos returns index of player near position', () => {
    pm.add('home', 1, '', '', 100, 100);
    const idx = pm.findByCanvasPos(100, 100, 1);
    expect(idx).toBe(0);
  });

  it('findByCanvasPos returns -1 when far away', () => {
    pm.add('home', 1, '', '', 100, 100);
    const idx = pm.findByCanvasPos(200, 200, 1);
    expect(idx).toBe(-1);
  });

  it('countByTeam returns correct counts', () => {
    pm.add('home', 1);
    pm.add('home', 2);
    pm.add('away', 1);
    expect(pm.countByTeam('home')).toBe(2);
    expect(pm.countByTeam('away')).toBe(1);
  });

  it('getColor returns correct team colors', () => {
    expect(pm.getColor('home')).toBe('#e94560');
    expect(pm.getColor('away')).toBe('#4a9eff');
  });

  it('lighten adds to each RGB channel', () => {
    const result = pm.lighten('#000000', 50);
    expect(result).toBe('rgb(50,50,50)');
  });

  it('darken subtracts from each RGB channel', () => {
    const result = pm.darken('#ffffff', 50);
    expect(result).toBe('rgb(205,205,205)');
  });

  it('lighten caps at 255', () => {
    const result = pm.lighten('#ffffff', 50);
    expect(result).toBe('rgb(255,255,255)');
  });

  it('darken caps at 0', () => {
    const result = pm.darken('#000000', 50);
    expect(result).toBe('rgb(0,0,0)');
  });

  it('applyFormation creates players from formation data', () => {
    const data = {
      home: [[5, 0, '1', 'GK'], [4, 3, '2', 'DEF'], [6, 3, '3', 'DEF']],
      away: [[5, 10, '1', 'GK']]
    };
    pm.applyFormation(data);
    expect(pm.count()).toBe(4);
    expect(pm.players[0].team).toBe('home');
    expect(pm.players[0].role).toBe('GK');
    expect(pm.players[3].team).toBe('away');
  });

  it('visible-only players are found by findByCanvasPos', () => {
    pm.add('home', 1, '', '', 100, 100);
    pm.players[0].visible = false;
    const idx = pm.findByCanvasPos(100, 100, 1);
    expect(idx).toBe(-1);
  });

  it('getPlayer returns null for invalid index', () => {
    expect(pm.getPlayer(0)).toBeNull();
    expect(pm.getPlayer(-1)).toBeNull();
  });
});
