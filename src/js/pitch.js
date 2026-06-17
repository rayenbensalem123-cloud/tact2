class PitchRenderer {
  constructor() {
    // FIFA standard pitch — horizontal: length along x, width along y
    this.PITCH_W = 1050;   // length (105m)
    this.PITCH_H = 680;    // width (68m)
    this.GOAL_W = 73.2;
    this.GOAL_DEPTH = 20;
    this.PA_W = 403.2;     // penalty area width across the pitch
    this.PA_D = 165;       // penalty area depth from goal line
    this.GA_W = 183.2;     // goal area width
    this.GA_D = 55;        // goal area depth
    this.CR = 91.5;        // center circle radius (9.15m)
    this.PA_ARC_R = 91.5;  // penalty arc radius
    this.CORNER_R = 10;    // corner arc radius (1m)
    this.PS_DIST = 110;    // penalty spot from goal line (11m)
    this.LW = 1.2;         // line width (12cm)

    this.HALF_W = this.PITCH_W / 2;
    this.HALF_H = this.PITCH_H / 2;
    this.style = 'green';
    this.lineColor = '#ffffff';
    this.view = 'full';
    this.showBench = false;
    this.orientation = 'horizontal';
  }

  getDimensions() {
    return { w: this.PITCH_W, h: this.PITCH_H };
  }

  getViewDimensions() {
    if (this.view === 'full') return { w: this.PITCH_W, h: this.PITCH_H };
    return { w: this.PITCH_W / 2 + 40, h: this.PITCH_H };
  }

  getGrassColors() {
    switch (this.style) {
      case 'dark': return ['#1a6e0e', '#2a8a1a', '#1a5e0e'];
      case 'dry': return ['#8a7a3a', '#9a8a4a', '#7a6a2a'];
      case 'gray': return ['#4a4a4a', '#5a5a5a', '#3a3a3a'];
      default: return ['#2a8e18', '#3aaa28', '#2a7e18'];
    }
  }

  drawBench(ctx, scale) {
    if (!this.showBench) return;
    const h = this.PITCH_H * scale;
    const by = this.PITCH_H * scale + 6 * scale;
    const bw = 30 * scale;
    const bh = this.PITCH_W * scale * 0.65;
    const bx = this.PITCH_W * scale * 0.1;

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = `${7 * scale}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Subs', bx + bw / 2, by - 10 * scale);
  }

  draw(ctx, scale, view) {
    this.view = view || this.view;
    const dim = this.getViewDimensions();
    const w = dim.w * scale;
    const h = dim.h * scale;
    const hw = w / 2;
    const hh = h / 2;
    const isHalf = this.view !== 'full';
    const isLeft = this.view === 'half-def';
    const lw = this.LW * scale;
    const lc = this.lineColor;

    this._drawGrass(ctx, scale, w, h, isHalf);

    // Pitch line shadow (subtle 3D effect)
    ctx.save();
    ctx.translate(1.5, 1.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeRect(0, 0, w, h);
    if (!isHalf) this._drawFullPitch(ctx, scale, w, h, hw, hh, 'rgba(0,0,0,0.08)', lw);
    else this._drawHalfPitch(ctx, scale, w, h, hw, hh, 'rgba(0,0,0,0.08)', lw, isLeft);
    ctx.restore();

    // Main white lines
    ctx.strokeStyle = lc;
    ctx.fillStyle = lc;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeRect(0, 0, w, h);

    if (!isHalf) {
      this._drawFullPitch(ctx, scale, w, h, hw, hh, lc, lw);
    } else {
      this._drawHalfPitch(ctx, scale, w, h, hw, hh, lc, lw, isLeft);
    }

    this.drawBench(ctx, scale);
  }

  _drawGrass(ctx, scale, w, h, isHalf) {
    const colors = this.getGrassColors();
    // Main grass gradient
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.5, colors[1]);
    grd.addColorStop(1, colors[2]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    // Realistic mowing stripes (alternating light/dark)
    const numStripes = isHalf ? 8 : 16;
    const stripeH = h / numStripes;
    for (let i = 0; i < numStripes; i++) {
      const y = i * stripeH;
      ctx.fillStyle = (i % 2 === 0)
        ? 'rgba(255,255,255,0.035)'
        : 'rgba(0,0,0,0.035)';
      ctx.fillRect(0, y, w, stripeH);
    }

    // Subtle grass grain texture (horizontal noise lines)
    ctx.globalAlpha = 0.015;
    for (let i = 0; i < 60; i++) {
      const gy = Math.random() * h;
      const gh = 1 + Math.random() * 2;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, gy, w, gh);
    }
    ctx.globalAlpha = 1;
  }

  _drawFullPitch(ctx, scale, w, h, hw, hh, lc, lw) {
    const s = scale;

    // Center line
    ctx.beginPath();
    ctx.moveTo(hw, 0);
    ctx.lineTo(hw, h);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(hw, hh, this.CR * s, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.beginPath();
    ctx.arc(hw, hh, 3 * s, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const paY = (this.PITCH_H - this.PA_W) / 2 * s;
    ctx.strokeRect(0, paY, this.PA_D * s, this.PA_W * s);
    ctx.strokeRect(w - this.PA_D * s, paY, this.PA_D * s, this.PA_W * s);

    // Goal areas
    const gaY = (this.PITCH_H - this.GA_W) / 2 * s;
    ctx.strokeRect(0, gaY, this.GA_D * s, this.GA_W * s);
    ctx.strokeRect(w - this.GA_D * s, gaY, this.GA_D * s, this.GA_W * s);

    // Goals (3D look)
    this._drawGoal(ctx, scale, 0, hh, true);
    this._drawGoal(ctx, scale, w, hh, false);

    // Penalty spots (11m from each goal line)
    ctx.beginPath(); ctx.arc(this.PS_DIST * s, hh, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w - this.PS_DIST * s, hh, 3 * s, 0, Math.PI * 2); ctx.fill();

    // Penalty arcs
    const pad = this.PA_D - this.PS_DIST;
    const dy = Math.sqrt(this.PA_ARC_R * this.PA_ARC_R - pad * pad);
    const chi = Math.atan2(dy, pad);
    ctx.beginPath();
    ctx.arc(this.PS_DIST * s, hh, this.PA_ARC_R * s, 2 * Math.PI - chi, chi, false);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w - this.PS_DIST * s, hh, this.PA_ARC_R * s, Math.PI - chi, Math.PI + chi, false);
    ctx.stroke();

    // Corner arcs (inside the pitch)
    const cr = this.CORNER_R * s;
    const arcs = [
      [0, 0, 0, Math.PI * 0.5],           // top-left
      [0, h, Math.PI * 1.5, Math.PI * 2], // bottom-left
      [w, 0, Math.PI * 0.5, Math.PI],     // top-right
      [w, h, Math.PI, Math.PI * 1.5],     // bottom-right
    ];
    for (const [cx, cy, sa, ea] of arcs) {
      ctx.beginPath();
      ctx.arc(cx, cy, cr, sa, ea, false);
      ctx.stroke();
    }
  }

  _drawHalfPitch(ctx, scale, w, h, hw, hh, lc, lw, isLeft) {
    const s = scale;

    // Penalty area
    const paY = (this.PITCH_H - this.PA_W) / 2 * s;
    const paX = isLeft ? 0 : w - this.PA_D * s;
    ctx.strokeRect(paX, paY, this.PA_D * s, this.PA_W * s);

    // Goal area
    const gaY = (this.PITCH_H - this.GA_W) / 2 * s;
    const gaX = isLeft ? 0 : w - this.GA_D * s;
    ctx.strokeRect(gaX, gaY, this.GA_D * s, this.GA_W * s);

    // Goal
    this._drawGoal(ctx, scale, isLeft ? 0 : w, hh, isLeft);

    // Penalty spot
    const pSpotX = isLeft ? this.PS_DIST * s : w - this.PS_DIST * s;
    ctx.beginPath(); ctx.arc(pSpotX, hh, 3 * s, 0, Math.PI * 2); ctx.fill();

    // Penalty arc
    const pad = this.PA_D - this.PS_DIST;
    const dyPA = Math.sqrt(this.PA_ARC_R * this.PA_ARC_R - pad * pad);
    const chi = Math.atan2(dyPA, pad);
    ctx.beginPath();
    if (isLeft) {
      ctx.arc(pSpotX, hh, this.PA_ARC_R * s, 2 * Math.PI - chi, chi, false);
    } else {
      ctx.arc(pSpotX, hh, this.PA_ARC_R * s, Math.PI - chi, Math.PI + chi, false);
    }
    ctx.stroke();

    // Corner arcs at goal line end (inside the pitch)
    const cr = this.CORNER_R * s;
    if (isLeft) {
      ctx.beginPath(); ctx.arc(0, 0, cr, 0, Math.PI * 0.5, false); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, h, cr, Math.PI * 1.5, Math.PI * 2, false); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(w, 0, cr, Math.PI * 0.5, Math.PI, false); ctx.stroke();
      ctx.beginPath(); ctx.arc(w, h, cr, Math.PI, Math.PI * 1.5, false); ctx.stroke();
    }

    // Center line (left edge of visible area)
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([4 * s, 6 * s]);
    ctx.beginPath();
    ctx.moveTo(isLeft ? w : 0, 0);
    ctx.lineTo(isLeft ? w : 0, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  _drawGoal(ctx, scale, cx, cy, isLeft) {
    const s = scale;
    const gw = this.GOAL_W * s / 2;
    const gd = this.GOAL_DEPTH * s;
    const pw = 3 * s; // post width

    ctx.save();

    if (isLeft) {
      // Goal depth shadow on grass
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - gw - pw);
      ctx.lineTo(cx - gd - pw, cy - gw - pw);
      ctx.lineTo(cx - gd - pw, cy + gw + pw);
      ctx.lineTo(cx, cy + gw + pw);
      ctx.closePath(); ctx.fill();

      // Net backdrop (white semi-transparent)
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(cx - gd - pw, cy - gw - pw, gd + pw, gw * 2 + pw * 2);

      // Net mesh
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.8 * s;
      const netRows = 10;
      const netCols = 6;
      const netH = (gw * 2) / netRows;
      const netW = gd / netCols;
      for (let r = 0; r <= netRows; r++) {
        const ny = cy - gw + r * netH;
        ctx.beginPath(); ctx.moveTo(cx, ny); ctx.lineTo(cx - gd, ny + 2); ctx.stroke();
      }
      for (let c = 0; c <= netCols; c++) {
        const nx = cx - c * netW;
        ctx.beginPath(); ctx.moveTo(nx, cy - gw); ctx.lineTo(nx + 2, cy + gw); ctx.stroke();
      }

      // Back post (rear frame)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = pw * 0.6;
      ctx.strokeRect(cx - gd - pw*0.5, cy - gw - pw*0.5, pw, gw * 2 + pw);

      // Front posts
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = pw;
      ctx.lineCap = 'round';
      // Top crossbar
      ctx.beginPath(); ctx.moveTo(cx - pw*0.3, cy - gw); ctx.lineTo(cx + pw*0.3, cy - gw); ctx.stroke();
      // Bottom crossbar
      ctx.beginPath(); ctx.moveTo(cx - pw*0.3, cy + gw); ctx.lineTo(cx + pw*0.3, cy + gw); ctx.stroke();
      // Side posts (front frame - thicker)
      ctx.lineWidth = pw * 1.2;
      ctx.beginPath(); ctx.moveTo(cx, cy - gw); ctx.lineTo(cx, cy + gw); ctx.stroke();
      // Post highlight (left edge)
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = pw * 0.3;
      ctx.beginPath(); ctx.moveTo(cx - pw*0.4, cy - gw + pw); ctx.lineTo(cx - pw*0.4, cy + gw - pw); ctx.stroke();

      // Ground line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(cx - gd - pw, cy + gw + pw); ctx.lineTo(cx, cy + gw + pw); ctx.stroke();
    } else {
      // Goal depth shadow on grass
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - gw - pw);
      ctx.lineTo(cx + gd + pw, cy - gw - pw);
      ctx.lineTo(cx + gd + pw, cy + gw + pw);
      ctx.lineTo(cx, cy + gw + pw);
      ctx.closePath(); ctx.fill();

      // Net backdrop
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(cx, cy - gw - pw, gd + pw, gw * 2 + pw * 2);

      // Net mesh
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.8 * s;
      const netRows2 = 10;
      const netCols2 = 6;
      const netH2 = (gw * 2) / netRows2;
      const netW2 = gd / netCols2;
      for (let r = 0; r <= netRows2; r++) {
        const ny = cy - gw + r * netH2;
        ctx.beginPath(); ctx.moveTo(cx, ny); ctx.lineTo(cx + gd, ny + 2); ctx.stroke();
      }
      for (let c = 0; c <= netCols2; c++) {
        const nx = cx + c * netW2;
        ctx.beginPath(); ctx.moveTo(nx, cy - gw); ctx.lineTo(nx - 2, cy + gw); ctx.stroke();
      }

      // Back post
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = pw * 0.6;
      ctx.strokeRect(cx + gd, cy - gw - pw*0.5, pw, gw * 2 + pw);

      // Front posts
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = pw;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - pw*0.3, cy - gw); ctx.lineTo(cx + pw*0.3, cy - gw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - pw*0.3, cy + gw); ctx.lineTo(cx + pw*0.3, cy + gw); ctx.stroke();
      ctx.lineWidth = pw * 1.2;
      ctx.beginPath(); ctx.moveTo(cx, cy - gw); ctx.lineTo(cx, cy + gw); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = pw * 0.3;
      ctx.beginPath(); ctx.moveTo(cx + pw*0.4, cy - gw + pw); ctx.lineTo(cx + pw*0.4, cy + gw - pw); ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(cx + gd + pw, cy + gw + pw); ctx.lineTo(cx, cy + gw + pw); ctx.stroke();
    }

    ctx.restore();
  }
}
