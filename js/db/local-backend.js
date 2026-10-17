const MESSAGES_KEY = 'si.messages';

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// localStorage-backed store. After every message the whole history is
// re-serialised to JSON (timestamp, sender and content included), so the
// browser always holds a complete log under a single key.
export class LocalBackend {
  constructor(kv, me = '') {
    this.kv = kv;
    this.me = me;
    this.kind = 'local';
    this._msgCbs = new Set();
    this._connCbs = new Set();
    this._unsubKv = kv.subscribe?.((key) => this._onExternal(key));
    this._cleanupTimer = null;
  }

  async init() {
    queueMicrotask(() => this._emitConn(true));
    this._notifyMessages();
    this._startCleanupTimer();
  }

  async sendMessage(partial) {
    const msgs = this._readMessages();
    const msg = {
      id: makeId(),
      ts: Date.now(),
      text: '',
      dataUrl: null,
      fileName: null,
      fileSize: null,
      mime: null,
      replyTo: null,
      ...partial,
    };
    msgs.push(msg);
    this._writeMessages(msgs);
    this._notifyMessages();
    return msg;
  }

  subscribeMessages(cb) {
    this._msgCbs.add(cb);
    cb(this._readMessages());
    return () => this._msgCbs.delete(cb);
  }

  onConnection(cb) {
    this._connCbs.add(cb);
    return () => this._connCbs.delete(cb);
  }

  // Delete messages older than `maxAgeDays` days. Runs on init and every
  // hour while the app is open, so history doesn't grow unboundedly in
  // localStorage.
  async cleanupOldMessages(maxAgeDays = 30) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const msgs = this._readMessages().filter((m) => m.ts >= cutoff);
    this._writeMessages(msgs);
    this._notifyMessages();
  }

  _startCleanupTimer() {
    this.cleanupOldMessages();
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._cleanupTimer = setInterval(() => this.cleanupOldMessages(), 60 * 60 * 1000);
    this._cleanupTimer.unref?.(); // don't keep the process/tab alive
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._cleanupTimer = null;
    this._unsubKv?.();
  }

  _readMessages() {
    try {
      const raw = this.kv.getItem(MESSAGES_KEY);
      const msgs = raw ? JSON.parse(raw) : [];
      return Array.isArray(msgs) ? msgs.slice().sort((x, y) => (x.ts || 0) - (y.ts || 0)) : [];
    } catch {
      return [];
    }
  }

  _writeMessages(msgs) {
    this.kv.setItem(MESSAGES_KEY, JSON.stringify(msgs));
  }

  _notifyMessages() {
    const msgs = this._readMessages();
    for (const cb of this._msgCbs) cb(msgs);
  }

  _emitConn(online) {
    for (const cb of this._connCbs) cb(online);
  }

  _onExternal(key) {
    if (key === MESSAGES_KEY) this._notifyMessages();
  }
}
