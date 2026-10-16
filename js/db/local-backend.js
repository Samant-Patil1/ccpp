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
  }

  async init() {
    queueMicrotask(() => this._emitConn(true));
    this._notifyMessages();
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
