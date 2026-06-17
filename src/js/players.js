class PlayerManager {
  constructor() {
    this.players = [];
    this.selectedIndices = new Set();
    this.homeColor = '#e94560';
    this.awayColor = '#4a9eff';
    this._faceCache = new Map();
  }

  create(team, number, name, role, x, y) {
    return {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '' + Math.random(),
      team, number, name: name || '', role: role || 'MID',
      x, y, visible: true, direction: 0,
      faceImage: '', faceZoom: 1, faceOffsetX: 0, faceOffsetY: 0
    };
  }

  add(team, number, name, role, x, y) {
    const p = this.create(team, number, name, role, x, y);
    this.players.push(p);
    return p;
  }

  remove(index) {
    if (index < 0 || index >= this.players.length) return;
    this.players.splice(index, 1);
    this.selectedIndices.delete(index);
    // Shift indices
    const newSet = new Set();
    for (const si of this.selectedIndices) {
      newSet.add(si > index ? si - 1 : si);
    }
    this.selectedIndices = newSet;
  }

  removeAll(indices) {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const i of sorted) this.remove(i);
  }

  get selected() {
    if (this.selectedIndices.size === 0) return null;
    return this.players[[...this.selectedIndices][this.selectedIndices.size - 1]];
  }

  get lastSelectedIndex() {
    if (this.selectedIndices.size === 0) return -1;
    return [...this.selectedIndices][this.selectedIndices.size - 1];
  }

  toggleSelect(index) {
    if (this.selectedIndices.has(index)) this.selectedIndices.delete(index);
    else this.selectedIndices.add(index);
  }

  select(index) {
    this.selectedIndices.clear();
    if (index >= 0 && index < this.players.length) this.selectedIndices.add(index);
  }

  selectAll() {
    this.selectedIndices = new Set(this.players.map((_, i) => i));
  }

  selectInRect(x1, y1, x2, y2) {
    this.selectedIndices.clear();
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    this.players.forEach((p, i) => {
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        this.selectedIndices.add(i);
      }
    });
  }

  getPlayer(index) { return this.players[index] || null; }
  count() { return this.players.length; }
  countByTeam(team) { return this.players.filter(p => p.team === team).length; }

  findByCanvasPos(cx, cy, scale) {
    const hitR = 32 * scale;
    for (let i = this.players.length - 1; i >= 0; i--) {
      const p = this.players[i];
      if (!p.visible) continue;
      const wx = p.x * scale, wy = p.y * scale;
      if (Math.abs(cx - wx) < hitR && Math.abs(cy - wy) < hitR) return i;
    }
    return -1;
  }

  getColor(team) { return team === 'home' ? this.homeColor : this.awayColor; }

  draw(ctx, scale, searchTerm) {
    const term = (searchTerm || '').toLowerCase();
    this.players.forEach((p, i) => {
      if (!p.visible) return;
      if (term && !p.name.toLowerCase().includes(term) && !p.role.toLowerCase().includes(term)) return;
      const x = p.x * scale, y = p.y * scale;
      const r = 17 * scale;
      const color = this.getColor(p.team);
      const isGK = p.role === 'GK';

      // Ground shadow (wide, soft)
      const sg = ctx.createRadialGradient(x, y + r*0.5, r*0.1, x, y + r*0.6, r*2.5);
      sg.addColorStop(0, 'rgba(0,0,0,0.3)');
      sg.addColorStop(0.5, 'rgba(0,0,0,0.12)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(x, y + r*0.4, r*2.5, 0, Math.PI*2); ctx.fill();

      // Drop shadow offset
      ctx.beginPath();
      ctx.arc(x + 1.5*scale, y + 2.5*scale, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();

      // Base circle (dark outline)
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.darken(color, 40);
      ctx.fill();

      const hasFace = !!p.faceImage;

      if (hasFace) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();
        let img = this._faceCache.get(p.faceImage);
        if (!img) {
          img = new Image();
          img.onload = () => { if (typeof render === 'function') render(); };
          img.src = p.faceImage;
          this._faceCache.set(p.faceImage, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          const s = p.faceZoom || 1;
          const ox = (p.faceOffsetX || 0) * r * 0.5;
          const oy = (p.faceOffsetY || 0) * r * 0.5;
          const size = r * 2 * s;
          ctx.drawImage(img, x - size / 2 + ox, y - size / 2 + oy, size, size);
        } else {
          const grd = ctx.createRadialGradient(x - r*0.35, y - r*0.4, r*0.05, x, y, r);
          grd.addColorStop(0, this.lighten(color, 100));
          grd.addColorStop(0.15, this.lighten(color, 30));
          grd.addColorStop(0.5, color);
          grd.addColorStop(0.85, this.darken(color, 30));
          grd.addColorStop(1, this.darken(color, 60));
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = grd; ctx.fill();
        }
        ctx.restore();
      } else {
        // Main body gradient (3D sphere, stronger)
        const grd = ctx.createRadialGradient(x - r*0.35, y - r*0.4, r*0.05, x, y, r);
        grd.addColorStop(0, this.lighten(color, 100));
        grd.addColorStop(0.15, this.lighten(color, 30));
        grd.addColorStop(0.5, color);
        grd.addColorStop(0.85, this.darken(color, 30));
        grd.addColorStop(1, this.darken(color, 60));
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();

        // Jersey sash (diagonal stripe for team identity)
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
        ctx.clip();
        ctx.translate(x, y);
        ctx.rotate(-0.4);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(-r*0.15, -r, r*0.3, r*2);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(r*0.2, -r, r*0.15, r*2);
        ctx.restore();

        // Glossy specular highlight (bright curved reflection)
        ctx.beginPath();
        ctx.ellipse(x - r*0.25, y - r*0.3, r*0.5, r*0.35, -0.4, 0.2, 1.8);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();

        // Bright spot highlight
        const hl = ctx.createRadialGradient(x - r*0.35, y - r*0.4, 0, x - r*0.35, y - r*0.4, r*0.25);
        hl.addColorStop(0, 'rgba(255,255,255,0.35)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.beginPath(); ctx.arc(x - r*0.35, y - r*0.4, r*0.25, 0, Math.PI*2); ctx.fill();

        // Rim highlight (top-left arc)
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(x - r*0.1, y - r*0.1, r*0.82, -0.6, 1.4); ctx.stroke();
      }

      // Outer ring (GK gets golden, others get white border)
      ctx.strokeStyle = isGK ? '#ffdd00' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = isGK ? 2.5 : 1.8;
      ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI*2); ctx.stroke();

      // GK cap/hands indicator (only on non-face tokens)
      if (isGK && !hasFace) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.ellipse(x + r*0.7, y - r*0.15, r*0.15, r*0.25, 0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - r*0.7, y - r*0.15, r*0.15, r*0.25, -0.3, 0, Math.PI*2); ctx.fill();
      }

      // Direction indicator (filled triangle with shadow)
      if (p.direction) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.direction);
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(r + 2, -5);
        ctx.lineTo(r + 10, 0);
        ctx.lineTo(r + 2, 5);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Player number with outline for readability
      const fontSize = Math.max(11, 13 * scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${fontSize}px -apple-system, sans-serif`;
      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(p.number || '', x, y + 0.5);
      // Fill
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 2;
      ctx.fillText(p.number || '', x, y + 0.5);
      ctx.shadowBlur = 0;

      // Role badge (small text below number)
      if (!isGK) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `600 ${Math.max(6, 7 * scale)}px -apple-system, sans-serif`;
        ctx.fillText(p.role || '', x, y + r * 0.45);
      }

      // Selection highlight (glow + dashed ring)
      if (this.selectedIndices.has(i)) {
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#ffdd00';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(x, y, r + 5 * scale/16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
    });
  }

  drawLabels(ctx, scale) {
    this.players.forEach(p => {
      if (!p.visible) return;
      const x = p.x * scale, y = p.y * scale;
      const r = 17 * scale;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${9 * scale}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.name || p.role || '', x, y + r + 5 * scale/16);
      ctx.shadowBlur = 0;
    });
  }

  lighten(hex, amt) {
    const c = parseInt(hex.replace('#',''), 16);
    return `rgb(${Math.min(255,(c>>16)+amt)},${Math.min(255,((c>>8)&0xff)+amt)},${Math.min(255,(c&0xff)+amt)})`;
  }

  darken(hex, amt) {
    const c = parseInt(hex.replace('#',''), 16);
    return `rgb(${Math.max(0,(c>>16)-amt)},${Math.max(0,((c>>8)&0xff)-amt)},${Math.max(0,(c&0xff)-amt)})`;
  }

  applyFormation(data) {
    this.players = [];
    this.selectedIndices.clear();
    // Horizontal pitch: x = position along length, y = position across width
    // gy (0-11 along pitch) → x, gx (0-10 across pitch) → y (flipped for camera side)
    const stepLen = 1050 / 11;
    const stepWid = 680 / 10;
    let num = 1;
    data.home.forEach(([gx, gy, pos, role]) => {
      this.add('home', num++, pos, role, gy * stepLen, (10 - gx) * stepWid);
    });
    num = 1;
    data.away.forEach(([gx, gy, pos, role]) => {
      this.add('away', num++, pos, role, gy * stepLen, (10 - gx) * stepWid);
    });
  }
}
