class AnimationManager {
  constructor() {
    this.keyframes = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTime = 0;
    this.speed = 1;
    this.loop = false;
    this.animFrameId = null;
    this.lastTimestamp = 0;
    this.onFrame = null;
    this.savedPositions = null;
    this.savedEquipment = null;
  }

  get totalDuration() {
    if (this.keyframes.length < 2) return 0;
    return this.keyframes[this.keyframes.length - 1].time;
  }

  get currentKeyframeIndex() {
    if (this.keyframes.length === 0) return -1;
    for (let i = this.keyframes.length - 1; i >= 0; i--) {
      if (this.currentTime >= this.keyframes[i].time - 0.001) return i;
    }
    return 0;
  }

  captureSnapshot(players) {
    return players.map(p => ({
      x: p.x, y: p.y, direction: p.direction, visible: p.visible
    }));
  }

  restoreSnapshot(players, snapshot) {
    snapshot.forEach((s, i) => {
      if (players[i]) {
        players[i].x = s.x;
        players[i].y = s.y;
        players[i].direction = s.direction;
        players[i].visible = s.visible;
      }
    });
  }

  captureEquipSnapshot(items) {
    return items.map(eq => ({
      x: eq.x, y: eq.y, size: eq.size || 1, rotation: eq.rotation || 0
    }));
  }

  restoreEquipSnapshot(items, snapshot) {
    snapshot.forEach((s, i) => {
      if (items[i]) {
        items[i].x = s.x;
        items[i].y = s.y;
        items[i].size = s.size;
        items[i].rotation = s.rotation;
      }
    });
  }

  addKeyframe(players, equipmentItems) {
    const playerSnap = this.captureSnapshot(players);
    const equipSnap = equipmentItems ? this.captureEquipSnapshot(equipmentItems) : [];
    const time = this.keyframes.length === 0 ? 0
      : this.keyframes[this.keyframes.length - 1].time + 1;
    this.keyframes.push({ time, players: playerSnap, equipment: equipSnap });
  }

  removeKeyframe(index) {
    if (index < 0 || index >= this.keyframes.length) return;
    this.keyframes.splice(index, 1);
    if (this.currentTime >= this.totalDuration) {
      this.currentTime = this.totalDuration;
    }
  }

  clearKeyframes() {
    this.keyframes = [];
    this.currentTime = 0;
    this.stop();
  }

  getPositionsAt(time) {
    if (this.keyframes.length === 0) return { players: [], equipment: [] };
    if (this.keyframes.length === 1) return { players: this.keyframes[0].players, equipment: this.keyframes[0].equipment || [] };

    let kfA = this.keyframes[0];
    let kfB = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (time >= this.keyframes[i].time && time <= this.keyframes[i + 1].time) {
        kfA = this.keyframes[i];
        kfB = this.keyframes[i + 1];
        break;
      }
    }

    if (time <= kfA.time) return { players: kfA.players, equipment: kfA.equipment || [] };
    if (time >= kfB.time) return { players: kfB.players, equipment: kfB.equipment || [] };

    const t = kfA.time === kfB.time ? 0 : (time - kfA.time) / (kfB.time - kfA.time);
    const pCount = Math.min(kfA.players.length, kfB.players.length);
    const players = kfA.players.slice(0, pCount).map((p, i) => ({
      x: p.x + (kfB.players[i].x - p.x) * t,
      y: p.y + (kfB.players[i].y - p.y) * t,
      direction: p.direction + (kfB.players[i].direction - p.direction) * t,
      visible: t < 0.5 ? p.visible : kfB.players[i].visible
    }));
    const eA = kfA.equipment || [], eB = kfB.equipment || [];
    const eCount = Math.min(eA.length, eB.length);
    const equipment = eA.slice(0, eCount).map((e, i) => ({
      x: e.x + (eB[i].x - e.x) * t,
      y: e.y + (eB[i].y - e.y) * t,
      size: e.size || 1,
      rotation: e.rotation || 0
    }));
    return { players, equipment };
  }

  play(players, equipmentItems) {
    if (this.keyframes.length < 2) return;
    this.savedPositions = this.captureSnapshot(players);
    this.savedEquipment = equipmentItems ? this.captureEquipSnapshot(equipmentItems) : null;
    this.isPlaying = true;
    this.isPaused = false;
    this.lastTimestamp = performance.now();
    this._tick(players, equipmentItems);
  }

  pause() {
    this.isPaused = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  stop(players, equipmentItems) {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.currentTime = 0;
    if (players && this.savedPositions) {
      this.restoreSnapshot(players, this.savedPositions);
    }
    if (equipmentItems && this.savedEquipment) {
      this.restoreEquipSnapshot(equipmentItems, this.savedEquipment);
    }
    this.savedPositions = null;
    this.savedEquipment = null;
  }

  seek(time, players, equipmentItems) {
    this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
    if (!this.isPlaying && players) {
      const pos = this.getPositionsAt(this.currentTime);
      this.restoreSnapshot(players, pos.players);
      if (equipmentItems) this.restoreEquipSnapshot(equipmentItems, pos.equipment);
    }
  }

  _tick(players, equipmentItems) {
    if (!this.isPlaying || this.isPaused) return;
    const now = performance.now();
    const dt = (now - this.lastTimestamp) / 1000 * this.speed;
    this.lastTimestamp = now;
    this.currentTime += dt;

    if (this.currentTime >= this.totalDuration) {
      if (this.loop) {
        this.currentTime = 0;
      } else {
        const endPos = this.getPositionsAt(this.totalDuration);
        this.restoreSnapshot(players, endPos.players);
        if (equipmentItems) this.restoreEquipSnapshot(equipmentItems, endPos.equipment);
        this.isPlaying = false;
        this.currentTime = this.totalDuration;
        if (this.onFrame) this.onFrame(this.currentTime, this.currentKeyframeIndex);
        return;
      }
    }

    const pos = this.getPositionsAt(this.currentTime);
    this.restoreSnapshot(players, pos.players);
    if (equipmentItems) this.restoreEquipSnapshot(equipmentItems, pos.equipment);

    if (this.onFrame) this.onFrame(this.currentTime, this.currentKeyframeIndex);

    this.animFrameId = requestAnimationFrame(() => this._tick(players, equipmentItems));
  }
}
