class DrawingEngine {
  constructor() {
    // Polyfill roundRect if not available
    if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r];
        const tl = r[0] || 0;
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tl, y);
        this.quadraticCurveTo(x + w, y, x + w, y + tl);
        this.lineTo(x + w, y + h - tl);
        this.quadraticCurveTo(x + w, y + h, x + w - tl, y + h);
        this.lineTo(x + tl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - tl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
      };
    }
    this.drawings = [];
    this.currentColor = '#ffdd00';
    this.currentWidth = 2;
    this.currentOpacity = 1;
    this.currentLineStyle = 'solid';
    this.currentFontSize = 28;
    this.tempDrawing = null;
    this.isDrawing = false;
    this.drawStart = null;
    this.points = [];
  }

  clear() { this.drawings = []; }

  setLineStyle(ctx, scale, style) {
    ctx.setLineDash([]);
    if (style === 'dashed') ctx.setLineDash([8 * scale/2, 5 * scale/2]);
    else if (style === 'dotted') ctx.setLineDash([2 * scale/2, 4 * scale/2]);
  }

  startStroke(type, x, y, color, width) {
    this.isDrawing = true;
    this.drawStart = { x, y };
    this.points = [{ x, y }];
    this.currentColor = color;
    this.currentWidth = width;

    if (type === 'pen') {
      this.tempDrawing = {
        type: 'pen', color, width, opacity: this.currentOpacity,
        lineStyle: this.currentLineStyle, points: [{ x, y }]
      };
    }
  }

  continueStroke(type, x, y) {
    this.points.push({ x, y });
    if (type === 'pen' && this.tempDrawing) {
      this.tempDrawing.points = [...this.points];
    }
  }

  endStroke(type, x, y) {
    if (!this.isDrawing) return null;
    this.isDrawing = false;
    const sx = this.drawStart.x;
    const sy = this.drawStart.y;
    let drawing = null;
    const base = { opacity: this.currentOpacity, lineStyle: this.currentLineStyle };

    switch (type) {
      case 'pen':
        if (this.points.length > 1) {
          drawing = { type: 'pen', color: this.currentColor, width: this.currentWidth, ...base, points: [...this.points] };
          this.tempDrawing = null;
        }
        break;
      case 'line':
        drawing = { type: 'line', color: this.currentColor, width: this.currentWidth, ...base, points: [{ x: sx, y: sy }, { x, y }] };
        break;
      case 'arrow':
        drawing = { type: 'arrow', color: this.currentColor, width: this.currentWidth, ...base, points: [{ x: sx, y: sy }, { x, y }] };
        break;
      case 'dashed':
        drawing = { type: 'arrow', color: this.currentColor, width: this.currentWidth, ...base, lineStyle: 'dashed', points: [{ x: sx, y: sy }, { x, y }] };
        break;
      case 'rect':
        if (Math.abs(x - sx) < 3 && Math.abs(y - sy) < 3) break; // too small
        drawing = { type: 'rect', color: this.currentColor, width: this.currentWidth, ...base, points: [{ x: sx, y: sy }, { x, y }], fill: true };
        break;
      case 'circle':
        if (Math.abs(x - sx) < 3 && Math.abs(y - sy) < 3) break; // too small
        drawing = { type: 'circle', color: this.currentColor, width: this.currentWidth, ...base, points: [{ x: sx, y: sy }, { x, y }], fill: true };
        break;
        case 'text':
        case 'textbox':
          drawing = { type: 'textbox', color: this.currentColor, width: this.currentWidth, ...base, points: [{ x: sx, y: sy }, { x, y }], text: 'Text', fontSize: this.currentFontSize, fill: true };
          break;
    }

    if (drawing) {
      this.drawings.push(drawing);
      return drawing;
    }
    return null;
  }

  hitTest(cx, cy, scale) {
    const r = 12 * scale; // larger touch target on mobile
    const r2 = r * r;
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.type === 'textbox') {
        if (!d.points || d.points.length < 2) continue;
        const rx = Math.min(d.points[0].x, d.points[1].x) * scale;
        const ry = Math.min(d.points[0].y, d.points[1].y) * scale;
        const rw = Math.abs(d.points[1].x - d.points[0].x) * scale;
        const rh = Math.abs(d.points[1].y - d.points[0].y) * scale;
        if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) return i;
        continue;
      }
      if (d.type === 'text') {
        const dx = cx - d.x * scale;
        const dy = cy - d.y * scale;
        if (Math.abs(dx) < 50 * scale && Math.abs(dy) < 20 * scale) return i;
        continue;
      }
      const pts = d.points;
      if (!pts || pts.length < 2) continue;
      // For shapes defined by two corners, also check inside
      if (d.type === 'rect' || d.type === 'circle') {
        const rx = Math.min(pts[0].x, pts[1].x) * scale;
        const ry = Math.min(pts[0].y, pts[1].y) * scale;
        const rw = Math.abs(pts[1].x - pts[0].x) * scale;
        const rh = Math.abs(pts[1].y - pts[0].y) * scale;
        // Expand hit area slightly
        if (cx >= rx - r && cx <= rx + rw + r && cy >= ry - r && cy <= ry + rh + r) return i;
        continue;
      }
      // Check distance to each line segment (for pen, line, arrow)
      for (let j = 0; j < pts.length - 1; j++) {
        const ax = pts[j].x * scale, ay = pts[j].y * scale;
        const bx = pts[j + 1].x * scale, by = pts[j + 1].y * scale;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) {
          const ex = cx - ax, ey = cy - ay;
          if (ex * ex + ey * ey < r2) return i;
          continue;
        }
        let t = ((cx - ax) * dx + (cy - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = ax + t * dx, py = ay + t * dy;
        const ex = cx - px, ey = cy - py;
        if (ex * ex + ey * ey < r2) return i;
      }
    }
    return -1;
  }

  hitTestText(cx, cy, scale) {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.type === 'textbox') {
        if (!d.points || d.points.length < 2) continue;
        const rx = Math.min(d.points[0].x, d.points[1].x) * scale;
        const ry = Math.min(d.points[0].y, d.points[1].y) * scale;
        const rw = Math.abs(d.points[1].x - d.points[0].x) * scale;
        const rh = Math.abs(d.points[1].y - d.points[0].y) * scale;
        if (cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh) return i;
        continue;
      }
      if (d.type !== 'text') continue;
      const dx = cx - d.x * scale;
      const dy = cy - d.y * scale;
      if (Math.abs(dx) < 40 * scale && Math.abs(dy) < 10 * scale) return i;
    }
    return -1;
  }

  removeAt(index) {
    if (index >= 0 && index < this.drawings.length) {
      this.drawings.splice(index, 1);
      return true;
    }
    return false;
  }

  getBounds(d) {
    if (d.type === 'text') {
      return { x: d.x - 2, y: d.y - 2, w: 4, h: 4 };
    }
    const pts = d.points || [];
    if (pts.length < 2) return null;
    if (d.type === 'pen') {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    return {
      x: Math.min(pts[0].x, pts[1].x),
      y: Math.min(pts[0].y, pts[1].y),
      w: Math.abs(pts[1].x - pts[0].x),
      h: Math.abs(pts[1].y - pts[0].y)
    };
  }

  bringToFront(index) {
    if (index < 0 || index >= this.drawings.length) return;
    const d = this.drawings.splice(index, 1)[0];
    this.drawings.push(d);
  }

  sendToBack(index) {
    if (index < 0 || index >= this.drawings.length) return;
    const d = this.drawings.splice(index, 1)[0];
    this.drawings.unshift(d);
  }

  draw(ctx, scale) {
    this.drawings.forEach(d => {
      ctx.strokeStyle = d.color;
      ctx.fillStyle = d.color;
      ctx.lineWidth = d.width * scale;
      ctx.globalAlpha = d.opacity ?? 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const ls = d.lineStyle || 'solid';
      this.setLineStyle(ctx, scale, ls);

      const pts = d.points ? d.points.map(p => ({ x: p.x * scale, y: p.y * scale })) : [];

      switch (d.type) {
        case 'pen': {
          if (pts.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
          break;
        }
        case 'line': {
          if (pts.length < 2) break;
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
          break;
        }
        case 'arrow': {
          if (pts.length < 2) break;
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
          ctx.setLineDash([]);
          const angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
          const hl = 12 * scale/2;
          ctx.beginPath();
          ctx.moveTo(pts[1].x, pts[1].y);
          ctx.lineTo(pts[1].x - hl * Math.cos(angle - 0.4), pts[1].y - hl * Math.sin(angle - 0.4));
          ctx.lineTo(pts[1].x - hl * Math.cos(angle + 0.4), pts[1].y - hl * Math.sin(angle + 0.4));
          ctx.closePath(); ctx.fill();
          break;
        }
        case 'rect': {
          if (pts.length < 2) break;
          const rx = Math.min(pts[0].x, pts[1].x), ry = Math.min(pts[0].y, pts[1].y);
          const rw = Math.abs(pts[1].x - pts[0].x), rh = Math.abs(pts[1].y - pts[0].y);
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.setLineDash([]);
          if (d.fill) { ctx.globalAlpha = (d.opacity ?? 1) * 0.15; ctx.fillRect(rx, ry, rw, rh); }
          break;
        }
        case 'circle': {
          if (pts.length < 2) break;
          const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
          const rx = Math.abs(pts[1].x - pts[0].x) / 2, ry = Math.abs(pts[1].y - pts[0].y) / 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          if (d.fill) { ctx.globalAlpha = (d.opacity ?? 1) * 0.15; ctx.fill(); }
          break;
        }
        case 'textbox': {
          if (pts.length < 2) break;
          const rx = Math.min(pts[0].x, pts[1].x), ry = Math.min(pts[0].y, pts[1].y);
          const rw = Math.abs(pts[1].x - pts[0].x), rh = Math.abs(pts[1].y - pts[0].y);
          const text = d.text != null ? d.text : 'Text';
          const pad = 6 * scale;
          const maxW = rw - pad * 2;
          if (maxW > 4 && rh > 4) {
            let fontSize = (d.fontSize || 28) * scale;
            ctx.font = `${fontSize}px -apple-system, sans-serif`;
            const longestWord = text.split(' ').reduce((a, b) => a.length > b.length ? a : b);
            while (fontSize > 8 && ctx.measureText(longestWord).width > maxW) {
              fontSize *= 0.8;
              ctx.font = `${fontSize}px -apple-system, sans-serif`;
            }
            fontSize = Math.max(8, fontSize);
            ctx.font = `${fontSize}px -apple-system, sans-serif`;
            const lineH = fontSize * 1.3;
            // Word-wrap
            const words = text.split(' ');
            const lines = [];
            let line = '';
            for (const word of words) {
              const test = line ? line + ' ' + word : word;
              if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = word;
              } else {
                line = test;
              }
            }
            if (line) lines.push(line);
            // Draw from top with padding
            let y0 = ry + pad + lineH * 0.85;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = d.color;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, 4 * scale);
            ctx.clip();
            for (const l of lines) {
              ctx.fillText(l, rx + pad, y0);
              y0 += lineH;
            }
            ctx.restore();
          }
          break;
        }
        case 'text': {
          const fs = (d.fontSize || 28) * scale;
          ctx.font = `${fs}px -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const text = d.text != null ? d.text : '';
          ctx.fillStyle = d.color;
          ctx.globalAlpha = d.opacity ?? 1;
          ctx.fillText(text, d.x * scale, d.y * scale);
          break;
        }
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    });
  }

  drawPreview(ctx, scale, tool, start, current) {
    if (!start) return;
    const sx = start.x * scale, sy = start.y * scale;
    const cx = current.x * scale, cy = current.y * scale;
    ctx.strokeStyle = this.currentColor;
    ctx.fillStyle = this.currentColor;
    ctx.lineWidth = this.currentWidth * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.setLineStyle(ctx, scale, this.currentLineStyle);

    switch (tool) {
      case 'line':
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke();
        break;
      case 'arrow':
      case 'dashed': {
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.setLineDash([]);
        const angle = Math.atan2(cy - sy, cx - sx);
        const hl = 12 * scale/2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - hl * Math.cos(angle - 0.4), cy - hl * Math.sin(angle - 0.4));
        ctx.lineTo(cx - hl * Math.cos(angle + 0.4), cy - hl * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'rect':
      case 'text':
      case 'textbox': {
        const rx = Math.min(sx, cx), ry = Math.min(sy, cy);
        ctx.strokeRect(rx, ry, Math.abs(cx - sx), Math.abs(cy - sy));
        break;
      }
      case 'circle': {
        const mxc = (sx + cx) / 2, myc = (sy + cy) / 2;
        const rx = Math.abs(cx - sx) / 2, ry = Math.abs(cy - sy) / 2;
        ctx.beginPath(); ctx.ellipse(mxc, myc, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
    ctx.setLineDash([]);
  }
}
