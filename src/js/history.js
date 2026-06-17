class HistoryManager {
  constructor(maxSteps = 50) {
    this.maxSteps = maxSteps;
    this.clear();
  }

  clear() {
    this.stack = [];
    this.index = -1;
  }

  push(players, drawings, equipment, connections) {
    const snap = JSON.parse(JSON.stringify({ players, drawings, equipment, connections }));
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }
    this.stack.push(snap);
    if (this.stack.length > this.maxSteps) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  undo() {
    if (!this.canUndo()) return null;
    this.index--;
    return JSON.parse(JSON.stringify(this.stack[this.index]));
  }

  redo() {
    if (!this.canRedo()) return null;
    this.index++;
    return JSON.parse(JSON.stringify(this.stack[this.index]));
  }
}
