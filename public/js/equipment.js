class EquipmentManager {
  constructor() {
    this.items = [];
    this.selectedIndices = new Set();
  }

  static TYPES = {
    cone: { label: 'Cone', w: 22, h: 30, color: '#ff6600' },
    ball: { label: 'Ball', w: 22, h: 22, color: '#ffffff' },
    mannequin: { label: 'Mannequin', w: 30, h: 46, color: '#ffcc00' },
    hurdle: { label: 'Hurdle', w: 44, h: 20, color: '#ff4444' },
    ladder: { label: 'Ladder', w: 54, h: 16, color: '#ffffff' },
    flag: { label: 'Flag', w: 16, h: 38, color: '#ffdd00' },
    ring: { label: 'Ring', w: 32, h: 32, color: '#4a9eff' },
    pole: { label: 'Pole', w: 12, h: 42, color: '#cccccc' },
    leader: { label: 'Leader', w: 32, h: 32, color: '#ffdd00' },
    plot: { label: 'Plot', w: 14, h: 14, color: '#ff4444' },
  };

  create(type, x, y, size) {
    const def = EquipmentManager.TYPES[type];
    return {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '' + Math.random(),
      type, x, y, rotation: 0, size: size || 1,
      label: def.label, color: def.color
    };
  }

  add(type, x, y, size) {
    const item = this.create(type, x, y, size);
    this.items.push(item);
    return item;
  }

  remove(index) {
    if (index < 0 || index >= this.items.length) return;
    this.items.splice(index, 1);
    this.selectedIndices.delete(index);
    const newSet = new Set();
    for (const si of this.selectedIndices) newSet.add(si > index ? si - 1 : si);
    this.selectedIndices = newSet;
  }

  removeAll(indices) {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const i of sorted) this.remove(i);
  }

  select(index) {
    this.selectedIndices.clear();
    if (index >= 0 && index < this.items.length) this.selectedIndices.add(index);
  }

  selectInRect(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    this.items.forEach((item, i) => {
      if (item.x >= minX && item.x <= maxX && item.y >= minY && item.y <= maxY) {
        this.selectedIndices.add(i);
      }
    });
  }

  get lastSelectedIndex() {
    if (this.selectedIndices.size === 0) return -1;
    return [...this.selectedIndices][this.selectedIndices.size - 1];
  }

  findByCanvasPos(cx, cy, scale) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      const def = EquipmentManager.TYPES[item.type];
      const dx = cx - item.x * scale;
      const dy = cy - item.y * scale;
      const hitR = Math.max(def.w, def.h) * scale * (item.size || 1);
      if (dx * dx + dy * dy < hitR * hitR) return i;
    }
    return -1;
  }

  draw(ctx, scale) {
    this.items.forEach((item, idx) => {
      const x = item.x * scale;
      const y = item.y * scale;
      const s = scale / 2 * (item.size || 1);
      const def = EquipmentManager.TYPES[item.type];
      const isSelected = this.selectedIndices.has(idx);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(item.rotation || 0);

      // === shadow ===
      const sh = (sx, sy, rx, ry) => {
        ctx.save();
        const sg = ctx.createRadialGradient(sx, sy-3, 0, sx, sy, rx*1.1);
        sg.addColorStop(0, 'rgba(0,0,0,0.25)');
        sg.addColorStop(0.7, 'rgba(0,0,0,0.12)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      };

      switch (item.type) {
        case 'cone': {
          const ch = 22 * s, cw = 9 * s, bw = cw * 0.38;
          sh(2*s, ch*0.65+2*s, cw*1.5, 3*s);
          ctx.save();
          const gb = ctx.createLinearGradient(-cw, ch*0.1, cw, ch*0.1);
          gb.addColorStop(0, '#ff8833'); gb.addColorStop(0.25, '#ff6600');
          gb.addColorStop(0.5, '#ff5500'); gb.addColorStop(0.75, '#ff6600'); gb.addColorStop(1, '#cc4400');
          ctx.fillStyle = gb;
          ctx.beginPath(); ctx.moveTo(0, -ch); ctx.lineTo(-cw, ch*0.65); ctx.lineTo(cw, ch*0.65); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#993300'; ctx.lineWidth = 1.2*s; ctx.stroke();
          const gr = ctx.createLinearGradient(-cw*0.5, ch*0.08, cw*0.5, ch*0.08);
          gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(-cw*0.5, ch*0.02, cw, 2.5*s, 0.5*s); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.roundRect(-cw*0.6, ch*0.28, cw*1.2, 2*s, 0.3*s); ctx.fill();
          ctx.fillStyle = '#cc6600'; ctx.beginPath(); ctx.ellipse(0, -ch, bw, bw*0.5, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#993300'; ctx.lineWidth = 0.8*s; ctx.stroke();
          ctx.fillStyle = '#553300'; ctx.beginPath(); ctx.roundRect(-cw*1.5, ch*0.6, cw*3, 3*s, 0.5*s); ctx.fill();
          ctx.strokeStyle = '#332200'; ctx.lineWidth = 0.8*s; ctx.stroke();
          ctx.restore();
          break;
        }
        case 'ball': {
          const br = 11 * s;
          sh(2*s, 2*s, br*0.9, 3*s);
          ctx.save();
          const bg = ctx.createRadialGradient(-3*s, -4*s, 0, 0, 0, br);
          bg.addColorStop(0, '#fff'); bg.addColorStop(0.65, '#f0f0f0'); bg.addColorStop(1, '#ccc');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, br, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.8*s; ctx.stroke();
          ctx.fillStyle = '#222';
          const pa = 5.5*s, sr = 3.8*s;
          const angleOff = 0;
          for (let i = 0; i < 5; i++) {
            const a = angleOff + i * Math.PI * 2 / 5 - Math.PI/2;
            const cx2 = Math.cos(a) * pa, cy2 = Math.sin(a) * pa;
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
              const ja = j * Math.PI * 2 / 5 - Math.PI/2;
              const px = cx2 + Math.cos(ja) * sr, py = cy2 + Math.sin(ja) * sr;
              j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill();
          }
          ctx.strokeStyle = '#999'; ctx.lineWidth = 0.6*s;
          for (let i = 0; i < 5; i++) {
            const a = angleOff + i * Math.PI * 2 / 5 - Math.PI/2;
            const cx2 = Math.cos(a) * pa, cy2 = Math.sin(a) * pa;
            for (let j = 0; j < 5; j++) {
              const ja = j * Math.PI * 2 / 5 - Math.PI/2;
              const px = cx2 + Math.cos(ja) * sr, py = cy2 + Math.sin(ja) * sr;
              const ox = Math.cos(ja + a * 0.3) * br, oy = Math.sin(ja + a * 0.3) * br;
              ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ox, oy); ctx.stroke();
            }
          }
          ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.5*s;
          ctx.beginPath(); ctx.arc(0, 0, 7.5*s, 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath(); ctx.ellipse(-3*s, -4*s, 5*s, 3.5*s, -0.3, 0, Math.PI*2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'mannequin': {
          ctx.save();
          ctx.rotate(-(item.rotation || 0));
          const ms = s * 1.3;
          sh(0, 12*s, 8*s, 4*s);
          const col = '#ffcc00';
          ctx.lineCap = 'round';
          // 3D rotation around Y axis using item.rotation
          const angle = item.rotation || 0;
          const ca = Math.cos(angle), sa = Math.sin(angle);
          const depth = 3 * ms;
          // rotate 3D point [x,y,z] around Y axis, project to 2D
          const pj = (x, y, z) => {
            const rx = x * ca + z * sa;
            const ry = y;
            const rz = -x * sa + z * ca;
            return { sx: rx, sy: ry + rz * 0.2 };
          };
          // tube draw helper
          const tube = (x1, y1, z1, x2, y2, z2, w) => {
            const a = pj(x1, y1, z1), b = pj(x2, y2, z2);
            const half = w / 2;
            ctx.strokeStyle = col;
            ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
            // highlight on forward-facing side
            const nx = -(b.sy - a.sy), ny = (b.sx - a.sx);
            const nl = Math.hypot(nx, ny) || 1;
            const hx = a.sx + (b.sx - a.sx) * 0.3, hy = a.sy + (b.sy - a.sy) * 0.3;
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = half;
            ctx.beginPath(); ctx.moveTo(hx + nx/nl * half*0.4, hy + ny/nl * half*0.4);
            ctx.lineTo(hx + nx/nl * half*0.6, hy + ny/nl * half*0.6);
            ctx.stroke();
          };
          const F = depth, B = -depth;
          // Head rectangle (front and back)
          tube(-2.5*ms, -11*ms, F, 2.5*ms, -11*ms, F, 2.5*ms);
          tube(2.5*ms, -11*ms, F, 2.5*ms, -7*ms, F, 2.5*ms);
          tube(2.5*ms, -7*ms, F, -2.5*ms, -7*ms, F, 2.5*ms);
          tube(-2.5*ms, -7*ms, F, -2.5*ms, -11*ms, F, 2.5*ms);
          tube(-2.5*ms, -11*ms, B, 2.5*ms, -11*ms, B, 2.5*ms);
          tube(2.5*ms, -11*ms, B, 2.5*ms, -7*ms, B, 2.5*ms);
          tube(2.5*ms, -7*ms, B, -2.5*ms, -7*ms, B, 2.5*ms);
          tube(-2.5*ms, -7*ms, B, -2.5*ms, -11*ms, B, 2.5*ms);
          // Head depth connectors
          tube(-2.5*ms, -11*ms, F, -2.5*ms, -11*ms, B, 1.5*ms);
          tube(2.5*ms, -11*ms, F, 2.5*ms, -11*ms, B, 1.5*ms);
          tube(-2.5*ms, -7*ms, F, -2.5*ms, -7*ms, B, 1.5*ms);
          tube(2.5*ms, -7*ms, F, 2.5*ms, -7*ms, B, 1.5*ms);
          // Neck diagonals: head bottom → shoulders
          tube(-2.5*ms, -7*ms, F, -5.5*ms, -5.5*ms, F, 2.5*ms);
          tube(2.5*ms, -7*ms, F, 5.5*ms, -5.5*ms, F, 2.5*ms);
          tube(-2.5*ms, -7*ms, B, -5.5*ms, -5.5*ms, B, 2.5*ms);
          tube(2.5*ms, -7*ms, B, 5.5*ms, -5.5*ms, B, 2.5*ms);
          // Shoulder connection (front-to-back)
          tube(-5.5*ms, -5.5*ms, F, -5.5*ms, -5.5*ms, B, 1.5*ms);
          tube(5.5*ms, -5.5*ms, F, 5.5*ms, -5.5*ms, B, 1.5*ms);
          // Side rails (shoulder → hip)
          tube(-5.5*ms, -5.5*ms, F, -3.5*ms, 1.5*ms, F, 2.5*ms);
          tube(5.5*ms, -5.5*ms, F, 3.5*ms, 1.5*ms, F, 2.5*ms);
          tube(-5.5*ms, -5.5*ms, B, -3.5*ms, 1.5*ms, B, 2.5*ms);
          tube(5.5*ms, -5.5*ms, B, 3.5*ms, 1.5*ms, B, 2.5*ms);
          // Hip cross bar
          tube(-3.5*ms, 1.5*ms, F, 3.5*ms, 1.5*ms, F, 3*ms);
          tube(-3.5*ms, 1.5*ms, B, 3.5*ms, 1.5*ms, B, 3*ms);
          tube(-3.5*ms, 1.5*ms, F, -3.5*ms, 1.5*ms, B, 1.5*ms);
          tube(3.5*ms, 1.5*ms, F, 3.5*ms, 1.5*ms, B, 1.5*ms);
          // Legs
          tube(-2.5*ms, 1.5*ms, F, -2.5*ms, 10*ms, F, 2.5*ms);
          tube(2.5*ms, 1.5*ms, F, 2.5*ms, 10*ms, F, 2.5*ms);
          tube(-2.5*ms, 1.5*ms, B, -2.5*ms, 10*ms, B, 2.5*ms);
          tube(2.5*ms, 1.5*ms, B, 2.5*ms, 10*ms, B, 2.5*ms);
          tube(-2.5*ms, 10*ms, F, -2.5*ms, 10*ms, B, 1.5*ms);
          tube(2.5*ms, 10*ms, F, 2.5*ms, 10*ms, B, 1.5*ms);
          // Base bar
          tube(-5*ms, 10*ms, F, 5*ms, 10*ms, F, 3.5*ms);
          tube(-5*ms, 10*ms, B, 5*ms, 10*ms, B, 3.5*ms);
          tube(-5*ms, 10*ms, F, -5*ms, 10*ms, B, 1.5*ms);
          tube(5*ms, 10*ms, F, 5*ms, 10*ms, B, 1.5*ms);
          // Mesh grid on front face of torso
          const tl = pj(-5*ms, -4.5*ms, F), tr = pj(5*ms, -4.5*ms, F);
          const bl = pj(-3.5*ms, 1*ms, F), br = pj(3.5*ms, 1*ms, F);
          ctx.strokeStyle = 'rgba(255,204,0,0.2)';
          ctx.lineWidth = 1.2*s;
          const divs = 4;
          for (let i = 1; i < divs; i++) {
            const t = i / divs;
            const lx = tl.sx + (bl.sx - tl.sx) * t, ly = tl.sy + (bl.sy - tl.sy) * t;
            const rx = tr.sx + (br.sx - tr.sx) * t, ry = tr.sy + (br.sy - tr.sy) * t;
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
          }
          for (let i = 1; i < divs; i++) {
            const t = i / divs;
            const tx = tl.sx + (tr.sx - tl.sx) * t, ty = tl.sy + (tr.sy - tl.sy) * t;
            const bx = bl.sx + (br.sx - bl.sx) * t, by = bl.sy + (br.sy - bl.sy) * t;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx, by); ctx.stroke();
          }
          // Horizontal bar across torso (front)
          const hbL = pj(-4.5*ms, (1.5-4.5)/2*ms, F);
          const hbR = pj(4.5*ms, (1.5-4.5)/2*ms, F);
          ctx.strokeStyle = col;
          ctx.lineWidth = 3.5*ms;
          ctx.beginPath(); ctx.moveTo(hbL.sx, hbL.sy); ctx.lineTo(hbR.sx, hbR.sy); ctx.stroke();
          // Circular ring element (front)
          const barY3d = (1.5 - 4.5) / 2;
          const steps = 16;
          ctx.lineWidth = 2.5*ms;
          ctx.strokeStyle = col;
          ctx.beginPath();
          for (let i = 0; i <= steps; i++) {
            const a2 = i / steps * Math.PI * 2;
            const cx = Math.cos(a2) * 2.5*ms, cy = Math.sin(a2) * 2.5*ms;
            const p = pj(cx, barY3d*ms + cy, F);
            i === 0 ? ctx.moveTo(p.sx, p.sy) : ctx.lineTo(p.sx, p.sy);
          }
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'hurdle': {
          sh(0, 11*s, 28*s, 3*s);
          ctx.save();
          ctx.strokeStyle = '#ff6666'; ctx.lineWidth = 4.5*s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-20*s, -8*s); ctx.lineTo(-23*s, 10*s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(20*s, -8*s); ctx.lineTo(23*s, 10*s); ctx.stroke();
          ctx.strokeStyle = '#cc2222'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-20*s, -8*s); ctx.lineTo(-23*s, 10*s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(20*s, -8*s); ctx.lineTo(23*s, 10*s); ctx.stroke();
          ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 5.5*s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-22*s, -8*s); ctx.lineTo(22*s, -8*s); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2*s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-18*s, -9.5*s); ctx.lineTo(18*s, -9.5*s); ctx.stroke();
          ctx.fillStyle = '#333'; ctx.beginPath(); ctx.roundRect(-26*s, 8*s, 6*s, 3.5*s, 1*s); ctx.fill();
          ctx.fillStyle = '#333'; ctx.beginPath(); ctx.roundRect(20*s, 8*s, 6*s, 3.5*s, 1*s); ctx.fill();
          ctx.restore();
          break;
        }
        case 'ladder': {
          sh(0, 9*s, 28*s, 3*s);
          ctx.save();
          ctx.lineCap = 'butt';
          ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 4*s;
          ctx.beginPath(); ctx.moveTo(-24*s, -7*s); ctx.lineTo(24*s, -7*s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-24*s, 7*s); ctx.lineTo(24*s, 7*s); ctx.stroke();
          ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2*s;
          ctx.beginPath(); ctx.moveTo(-24*s, -7*s); ctx.lineTo(24*s, -7*s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-24*s, 7*s); ctx.lineTo(24*s, 7*s); ctx.stroke();
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3.5*s; ctx.lineCap = 'round';
          for (let i = 0; i < 8; i++) {
            const rx = -22*s + i * 6.5*s;
            ctx.beginPath(); ctx.moveTo(rx, -7*s); ctx.lineTo(rx, 7*s); ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5*s;
          for (let i = 0; i < 8; i++) {
            const rx = -22*s + i * 6.5*s;
            ctx.beginPath(); ctx.moveTo(rx+1*s, -6*s); ctx.lineTo(rx+1*s, 6*s); ctx.stroke();
          }
          ctx.restore();
          break;
        }
        case 'flag': {
          sh(0, 18*s, 12*s, 3*s);
          ctx.save();
          const pg = ctx.createLinearGradient(-2*s, 0, 2*s, 0);
          pg.addColorStop(0, '#999'); pg.addColorStop(0.35, '#ddd');
          pg.addColorStop(0.65, '#ccc'); pg.addColorStop(1, '#888');
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.roundRect(-2*s, -20*s, 4*s, 36*s, 1.5*s); ctx.fill();
          ctx.strokeStyle = '#777'; ctx.lineWidth = 0.8*s; ctx.stroke();
          ctx.fillStyle = '#ffdd00';
          ctx.beginPath(); ctx.moveTo(2*s, -19*s); ctx.lineTo(20*s, -15*s); ctx.lineTo(19*s, -5*s); ctx.lineTo(2*s, -3*s); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#ccaa00'; ctx.lineWidth = 0.8*s; ctx.stroke();
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.beginPath(); ctx.moveTo(2*s, -19*s); ctx.lineTo(12*s, -17*s); ctx.lineTo(11*s, -7*s); ctx.lineTo(2*s, -3*s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#bbb';
          ctx.beginPath(); ctx.arc(0, -20*s, 2.5*s, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5*s; ctx.stroke();
          ctx.fillStyle = '#555'; ctx.beginPath(); ctx.roundRect(-3.5*s, 14.5*s, 7*s, 2.5*s, 0.5*s); ctx.fill();
          ctx.restore();
          break;
        }
        case 'ring': {
          sh(0, 3*s, 16*s, 4*s);
          ctx.save();
          const rr = 13 * s;
          ctx.strokeStyle = '#4a9eff'; ctx.lineWidth = 6.5*s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle = '#3a7ecc'; ctx.lineWidth = 2.5*s;
          ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2.5*s;
          ctx.beginPath(); ctx.arc(-2*s, -2*s, rr+1*s, 4.2, 5.6); ctx.stroke();
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2*s;
          ctx.beginPath(); ctx.arc(0, 1.5*s, rr-2*s, 0.3, 1.5); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'plot': {
          const pr = 7 * s;
          sh(0, pr*0.5+2*s, pr*1.2, 3*s);
          ctx.save();
          // Flat disc — base color
          const pg = ctx.createRadialGradient(-1.5*s, -2*s, 0, 0, 0, pr);
          pg.addColorStop(0, '#ff6666'); pg.addColorStop(0.7, '#ff4444'); pg.addColorStop(1, '#cc2222');
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI*2); ctx.fill();
          // Rim edge (darker ring)
          ctx.strokeStyle = '#aa1818';
          ctx.lineWidth = 1.5*s;
          ctx.beginPath(); ctx.arc(0, 0, pr-0.8*s, 0, Math.PI*2); ctx.stroke();
          // Outer rim highlight (top-left)
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 2*s;
          ctx.beginPath(); ctx.arc(-1*s, -1*s, pr-1.5*s, 0.8, 2.5); ctx.stroke();
          // Center small dimple/dot
          ctx.fillStyle = '#991515';
          ctx.beginPath(); ctx.arc(0, 0, 1.8*s, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.beginPath(); ctx.arc(-0.5*s, -0.5*s, 1*s, 0, Math.PI*2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'pole': {
          const ph = 26 * s, pw = 3.5 * s;
          sh(0, ph*0.6, 10*s, 4.5*s);
          ctx.save();
          const sg = ctx.createLinearGradient(-pw, 0, pw, 0);
          sg.addColorStop(0, '#bbb'); sg.addColorStop(0.3, '#eee'); sg.addColorStop(0.7, '#ddd'); sg.addColorStop(1, '#999');
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.roundRect(-pw, -ph, pw*2, ph*1.6, 2*s); ctx.fill();
          ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8*s; ctx.stroke();
          ctx.fillStyle = '#777';
          ctx.beginPath(); ctx.ellipse(0, ph*0.55, 10*s, 4.5*s, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8*s; ctx.stroke();
          const cg = ctx.createRadialGradient(-1*s, -(ph+1.5)*s, 0, 0, -ph, 4.5*s);
          cg.addColorStop(0, '#eee'); cg.addColorStop(1, '#aaa');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.arc(0, -ph, 4.5*s, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#888'; ctx.lineWidth = 0.6*s; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3.5*s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-pw+1.5*s, -ph*0.15); ctx.lineTo(pw-1.5*s, -ph*0.15); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.5*s;
          ctx.beginPath(); ctx.moveTo(-pw+1*s, ph*0.15); ctx.lineTo(pw-1*s, ph*0.15); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'leader': {
          sh(3*s, 2*s, 16*s, 3*s);
          ctx.save();
          const al = 20 * s, aw = 12 * s;
          const lg = ctx.createLinearGradient(-al*0.3, -aw*0.5, al, aw*0.3);
          lg.addColorStop(0, '#ffee44'); lg.addColorStop(0.4, '#ffdd00'); lg.addColorStop(0.7, '#e6b800'); lg.addColorStop(1, '#cc9900');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(-al*0.3, -aw*0.3); ctx.lineTo(al*0.3, -aw*0.3);
          ctx.lineTo(al*0.3, -aw); ctx.lineTo(al, 0);
          ctx.lineTo(al*0.3, aw); ctx.lineTo(al*0.3, aw*0.3);
          ctx.lineTo(-al*0.3, aw*0.3); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#b38700'; ctx.lineWidth = 1.5*s; ctx.lineJoin = 'round'; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.moveTo(-al*0.15, -aw*0.15); ctx.lineTo(al*0.15, -aw*0.15);
          ctx.lineTo(al*0.15, -aw*0.55); ctx.lineTo(al*0.5, 0);
          ctx.lineTo(al*0.15, aw*0.55); ctx.lineTo(al*0.15, aw*0.15);
          ctx.lineTo(-al*0.15, aw*0.15); ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
      }

      if (isSelected) {
        ctx.rotate(-(item.rotation || 0));
        // Glow
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(0, 0, Math.max(def.w, def.h) * s + 5*s, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    });
  }
}
