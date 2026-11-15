class GIFEncoder {
  constructor(width, height, dither) {
    this.width = width;
    this.height = height;
    this.dither = dither || false;
    this.frames = [];
    this.delay = 100;
    this.repeat = 0;
  }

  setDelay(ms) { this.delay = ms; }
  setRepeat(n) { this.repeat = n; }

  addFrame(ctx) {
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    this.frames.push(imageData);
  }

  render() {
    const bytes = [];
    const w = this.width, h = this.height;

    // Header
    this._writeString(bytes, 'GIF89a');

    // Logical screen descriptor
    this._writeWord(bytes, w);
    this._writeWord(bytes, h);
    bytes.push(0xF7); // GCT present, 256 colors, sorted
    bytes.push(0);    // background color
    bytes.push(0);    // pixel aspect ratio

    // Global color table (256 colors, will be filled per-frame)
    const gct = new Array(256 * 3).fill(0);

    // We'll use a single global palette built from all frames
    this._buildGlobalPalette(gct);
    for (let i = 0; i < 256 * 3; i++) {
      bytes.push(gct[i]);
    }

    // Application extension (Netscape 2.0 for looping)
    if (this.repeat >= 0) {
      bytes.push(0x21, 0xFF, 0x0B);
      this._writeString(bytes, 'NETSCAPE2.0');
      bytes.push(0x03, 0x01);
      this._writeWord(bytes, this.repeat);
      bytes.push(0x00);
    }

    // Each frame
    for (let fi = 0; fi < this.frames.length; fi++) {
      const frame = this.frames[fi];

      // Graphics control extension
      bytes.push(0x21, 0xF9, 0x04);
      bytes.push(0x04); // disposal: leave
      this._writeWord(bytes, this.delay);
      bytes.push(0x00); // transparent index
      bytes.push(0x00);

      // Image descriptor
      bytes.push(0x2C);
      this._writeWord(bytes, 0);
      this._writeWord(bytes, 0);
      this._writeWord(bytes, w);
      this._writeWord(bytes, h);
      bytes.push(0x00); // no local color table

      // Image data (LZW compressed)
      this._writeLZW(bytes, frame, gct, w, h);
    }

    // Trailer
    bytes.push(0x3B);

    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  }

  _buildGlobalPalette(gct) {
    // Count color usage across all frames
    const colorCount = {};
    for (const frame of this.frames) {
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
        if (a < 128) continue; // skip transparent
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        colorCount[key] = (colorCount[key] || 0) + 1;
      }
    }

    // Sort by frequency and take top 256
    const sorted = Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 256);

    for (let i = 0; i < 256; i++) {
      if (i < sorted.length) {
        const key = parseInt(sorted[i][0]);
        gct[i * 3] = (key >> 10) << 3 | 4;
        gct[i * 3 + 1] = ((key >> 5) & 0x1F) << 3 | 4;
        gct[i * 3 + 2] = (key & 0x1F) << 3 | 4;
      } else {
        gct[i * 3] = 0; gct[i * 3 + 1] = 0; gct[i * 3 + 2] = 0;
      }
    }
  }

  _nearestColor(r, g, b, gct) {
    let bestDist = Infinity, bestIdx = 0;
    for (let i = 0; i < 256; i++) {
      const dr = r - gct[i * 3];
      const dg = g - gct[i * 3 + 1];
      const db = b - gct[i * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return bestIdx;
  }

  _writeLZW(bytes, frame, gct, w, h) {
    const data = new Uint8Array(frame.data);
    const pixels = new Uint8Array(w * h);
    if (this.dither) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const a = data[i + 3];
          if (a < 128) {
            pixels[y * w + x] = 0;
          } else {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const idx = this._nearestColor(r, g, b, gct);
            pixels[y * w + x] = idx;
            const er = r - gct[idx * 3];
            const eg = g - gct[idx * 3 + 1];
            const eb = b - gct[idx * 3 + 2];
            if (x + 1 < w) {
              data[i + 4] = Math.max(0, Math.min(255, data[i + 4] + er * 7 / 16));
              data[i + 5] = Math.max(0, Math.min(255, data[i + 5] + eg * 7 / 16));
              data[i + 6] = Math.max(0, Math.min(255, data[i + 6] + eb * 7 / 16));
            }
            if (y + 1 < h) {
              if (x > 0) {
                const j = i + w * 4 - 4;
                data[j] = Math.max(0, Math.min(255, data[j] + er * 3 / 16));
                data[j + 1] = Math.max(0, Math.min(255, data[j + 1] + eg * 3 / 16));
                data[j + 2] = Math.max(0, Math.min(255, data[j + 2] + eb * 3 / 16));
              }
              const j = i + w * 4;
              data[j] = Math.max(0, Math.min(255, data[j] + er * 5 / 16));
              data[j + 1] = Math.max(0, Math.min(255, data[j + 1] + eg * 5 / 16));
              data[j + 2] = Math.max(0, Math.min(255, data[j + 2] + eb * 5 / 16));
              if (x + 1 < w) {
                const j = i + w * 4 + 4;
                data[j] = Math.max(0, Math.min(255, data[j] + er * 1 / 16));
                data[j + 1] = Math.max(0, Math.min(255, data[j + 1] + eg * 1 / 16));
                data[j + 2] = Math.max(0, Math.min(255, data[j + 2] + eb * 1 / 16));
              }
            }
          }
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const a = data[i + 3];
          if (a < 128) {
            pixels[y * w + x] = 0;
          } else {
            pixels[y * w + x] = this._nearestColor(data[i], data[i + 1], data[i + 2], gct);
          }
        }
      }
    }

    const minCodeSize = 8;
    bytes.push(minCodeSize);

    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let nextCode = clearCode + 2;
    let maxCode = (1 << (minCodeSize + 1)) - 1;
    let codeSize = minCodeSize + 1;

    const dict = new Map();
    const output = [];

    function outputCode(code) {
      output.push(code & 0xFF);
      output.push((code >> 8) & 0xFF);
    }

    function clearDict() {
      dict.clear();
      nextCode = clearCode + 2;
      codeSize = minCodeSize + 1;
      maxCode = (1 << codeSize) - 1;
    }

    let string = null;
    outputCode(clearCode);

    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      if (string === null) {
        string = [pixel];
      } else {
        const newKey = [...string, pixel];
        const keyStr = newKey.join(',');
        if (dict.has(keyStr)) {
          string = newKey;
        } else {
          const strKey = string.join(',');
          const code = string.length === 1 ? string[0] : dict.get(strKey);
          outputCode(code);

          if (nextCode <= 4095) {
            dict.set(keyStr, nextCode++);
            if (nextCode > maxCode && nextCode <= 4095) {
              codeSize++;
              maxCode = (1 << codeSize) - 1;
            }
          }

          if (nextCode > 4095) {
            outputCode(clearCode);
            clearDict();
          }

          string = [pixel];
        }
      }
    }

    if (string !== null) {
      const strKey = string.join(',');
      const code = string.length === 1 ? string[0] : dict.get(strKey);
      if (code !== undefined) outputCode(code);
    }

    outputCode(eoiCode);

    // Pack into sub-blocks
    const bitStream = [];
    let buf = 0, bits = 0;
    for (let i = 0; i < output.length; i += 2) {
      const code = output[i] | (output[i + 1] << 8);
      buf |= (code & ((1 << codeSize) - 1)) << bits;
      bits += codeSize;
      while (bits >= 8) {
        bitStream.push(buf & 0xFF);
        buf >>= 8;
        bits -= 8;
      }
    }
    if (bits > 0) bitStream.push(buf & 0xFF);

    // Write sub-blocks
    for (let i = 0; i < bitStream.length; i += 255) {
      const chunk = bitStream.slice(i, i + 255);
      bytes.push(chunk.length);
      for (const b of chunk) bytes.push(b);
    }
    bytes.push(0x00); // block terminator
  }

  _writeString(bytes, str) {
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  }

  _writeWord(bytes, val) {
    bytes.push(val & 0xFF);
    bytes.push((val >> 8) & 0xFF);
  }
}
