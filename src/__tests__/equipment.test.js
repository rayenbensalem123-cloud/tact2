import { describe, it, expect, beforeEach } from 'vitest';

if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => 'test-uuid';

const fs = await import('fs');
const code = fs.readFileSync('src/js/equipment.js', 'utf-8');
eval(code + '\nglobalThis.EquipmentManager = EquipmentManager;');

describe('EquipmentManager', () => {
  let em;

  beforeEach(() => {
    em = new EquipmentManager();
  });

  it('starts empty', () => {
    expect(em.items).toHaveLength(0);
    expect(em.selectedIndices.size).toBe(0);
    expect(em.lastSelectedIndex).toBe(-1);
  });

  it('has static TYPES', () => {
    expect(EquipmentManager.TYPES.cone).toBeTruthy();
    expect(EquipmentManager.TYPES.ball).toBeTruthy();
    expect(EquipmentManager.TYPES.mannequin).toBeTruthy();
    expect(EquipmentManager.TYPES.hurdle).toBeTruthy();
    expect(EquipmentManager.TYPES.ladder).toBeTruthy();
    expect(EquipmentManager.TYPES.flag).toBeTruthy();
    expect(EquipmentManager.TYPES.ring).toBeTruthy();
    expect(EquipmentManager.TYPES.pole).toBeTruthy();
    expect(EquipmentManager.TYPES.leader).toBeTruthy();
    expect(EquipmentManager.TYPES.plot).toBeTruthy();
    expect(Object.keys(EquipmentManager.TYPES)).toHaveLength(10);
  });

  it('creates an equipment item', () => {
    const item = em.create('cone', 100, 200, 1);
    expect(item.type).toBe('cone');
    expect(item.x).toBe(100);
    expect(item.y).toBe(200);
    expect(item.size).toBe(1);
    expect(item.rotation).toBe(0);
    expect(item.label).toBe('Cone');
    expect(item.color).toBe('#ff6600');
  });

  it('adds an equipment item', () => {
    const item = em.add('ball', 50, 60, 2);
    expect(em.items).toHaveLength(1);
    expect(item.size).toBe(2);
  });

  it('add uses default size of 1', () => {
    em.add('flag', 0, 0);
    expect(em.items[0].size).toBe(1);
  });

  it('removes an item by index', () => {
    em.add('cone', 0, 0);
    em.add('ball', 10, 10);
    em.remove(0);
    expect(em.items).toHaveLength(1);
    expect(em.items[0].type).toBe('ball');
  });

  it('does nothing when removing invalid index', () => {
    em.add('cone', 0, 0);
    em.remove(-1);
    em.remove(5);
    expect(em.items).toHaveLength(1);
  });

  it('removeAll removes multiple by index', () => {
    em.add('cone', 0, 0);
    em.add('ball', 10, 10);
    em.add('flag', 20, 20);
    em.removeAll(new Set([0, 2]));
    expect(em.items).toHaveLength(1);
    expect(em.items[0].type).toBe('ball');
  });

  it('select selects a single item', () => {
    em.add('cone', 0, 0);
    em.add('ball', 10, 10);
    em.select(1);
    expect(em.selectedIndices.has(1)).toBe(true);
    expect(em.selectedIndices.size).toBe(1);
    expect(em.lastSelectedIndex).toBe(1);
  });

  it('select replaces previous selection', () => {
    em.add('cone', 0, 0);
    em.add('ball', 10, 10);
    em.select(0);
    em.select(1);
    expect(em.selectedIndices.has(0)).toBe(false);
    expect(em.selectedIndices.has(1)).toBe(true);
  });

  it('selectInRect finds items within bounds', () => {
    em.add('cone', 100, 100);
    em.add('ball', 200, 200);
    em.selectInRect(50, 50, 150, 150);
    expect(em.selectedIndices.size).toBe(1);
    expect(em.selectedIndices.has(0)).toBe(true);
  });

  it('selectInRect handles reversed coords', () => {
    em.add('cone', 100, 100);
    em.selectInRect(150, 150, 50, 50);
    expect(em.selectedIndices.has(0)).toBe(true);
  });

  it('findByCanvasPos returns correct item', () => {
    em.add('cone', 100, 100);
    // cone has w=22, h=30, scale=1, size=1
    // hitR = max(22,30) * 1 * 1 = 30
    // item at pixel position (100,100), test at (100,100)
    const idx = em.findByCanvasPos(100, 100, 1);
    expect(idx).toBe(0);
  });

  it('findByCanvasPos returns -1 when far away', () => {
    em.add('cone', 100, 100);
    const idx = em.findByCanvasPos(500, 500, 1);
    expect(idx).toBe(-1);
  });

  it('findByCanvasPos respects item size scaling', () => {
    em.add('cone', 100, 100, 3);
    // hitR = 30 * 1 * 3 = 90
    const idx = em.findByCanvasPos(150, 100, 1);
    expect(idx).toBe(0);
  });

  it('remove updates selectedIndices', () => {
    em.add('cone', 0, 0);
    em.add('ball', 10, 10);
    em.add('flag', 20, 20);
    em.selectedIndices.add(1);
    em.selectedIndices.add(2);
    em.remove(0);
    // Items shifted: old idx 1→0, old idx 2→1
    expect(em.selectedIndices.has(0)).toBe(true);
    expect(em.selectedIndices.has(1)).toBe(true);
    expect(em.selectedIndices.size).toBe(2);
  });
});
