// Supabase backend — persists every message in the `messages` table and
// streams inserts to every open session, so all users see the same
// conversation no matter which device or browser they use.
//
// Loaded dynamically (an ES module from a CDN) so that a failure to load
// the SDK degrades to the local backend instead of crashing the app.
//
// NOTE: the Supabase `messages` table uses lowercase column names
// (id, from, type, text, dataurl, filename, filesize, mime, replyto, ts).
// This backend translates between those DB names and the camelCase names
// the UI expects (dataUrl, fileName, fileSize, replyTo).

const CHANNEL_NAME = 'chat-room';

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Map a Supabase row (lowercase DB keys) to the camelCase shape the UI uses.
// Defensively accepts either casing so the backend keeps working if the
// table schema changes.
function normalizeRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    from: row.from,
    type: row.type,
    text: row.text ?? null,
    dataUrl: row.dataUrl ?? row.dataurl ?? null,
    fileName: row.fileName ?? row.filename ?? null,
    fileSize: row.fileSize ?? row.filesize ?? null,
    mime: row.mime ?? null,
    replyTo: (() => {
      const raw = row.replyTo ?? row.replyto ?? null;
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(raw); } catch { return raw; }
    })(),
    ts: row.ts ?? null,
  };
}

export class SupabaseBackend {
  constructor(config, me = '') {
    this.config = config;
    this.me = me;
    this.kind = 'supabase';
    this._client = null;
    this._channels = [];
    this._msgCbs = new Set();
    this._connCbs = new Set();
    this._cleanupTimer = null;
  }

  async init() {
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    const client = mod.createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    this._client = client;
    const channel = client
      .channel(CHANNEL_NAME)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => this._emitMessages(),
      );
    channel.subscribe();
    this._channels.push(channel);
    this._emitConn(true);
    this._startCleanupTimer();
  }

  async sendMessage(partial) {
    const id = makeId();
    const ts = Date.now();
    const { error } = await this._client
      .from('messages')
      .insert({
        id,
        from: this.me,
        type: partial.type,
        text: partial.text ?? null,
        dataurl: partial.dataUrl ?? null,
        filename: partial.fileName ?? null,
        filesize: partial.fileSize ?? null,
        mime: partial.mime ?? null,
        // replyTo is an object {id, from, preview}; store as JSON text so it
        // round-trips faithfully through the column.
        replyTo: partial.replyTo ? JSON.stringify(partial.replyTo) : null,
        ts,
      });
    if (error) throw new Error(error.message);
    // Return the camelCase shape the UI expects.
    return {
      id,
      from: this.me,
      type: partial.type,
      text: partial.text ?? null,
      dataUrl: partial.dataUrl ?? null,
      fileName: partial.fileName ?? null,
      fileSize: partial.fileSize ?? null,
      mime: partial.mime ?? null,
      replyTo: partial.replyTo ?? null,
      ts,
    };
  }

  subscribeMessages(cb) {
    this._msgCbs.add(cb);
    this._emitCurrent(); // immediately, like the local backend does
    return () => this._msgCbs.delete(cb);
  }

  onConnection(cb) {
    this._connCbs.add(cb);
    return () => this._connCbs.delete(cb);
  }

  // Every message is re-read from the database whenever the realtime
  // subscription reports a change — this is what makes all open
  // sessions converge on the same conversation.
  async _emitCurrent() {
    const { data, error } = await this._client
      .from('messages')
      .select('*')
      .order('ts', { ascending: true });
    if (error) {
      console.error('[chat] Could not load messages:', error.message);
      return;
    }
    const msgs = (data ?? []).map(normalizeRow);
    for (const cb of this._msgCbs) cb(msgs);
  }

  _emitMessages() {
    this._emitCurrent();
  }

  _emitConn(online) {
    for (const cb of this._connCbs) cb(online);
  }

  // ---- automatic message cleanup (retention) ----

  // Delete messages older than `maxAgeDays` days. Attached file data stored
  // inline in messages is removed together with its message row. Run on
  // init and periodically while the app is open; for a server-only monthly
  // job you can also schedule this SQL in the Supabase dashboard:
  //   delete from messages where ts < extract(epoch from now() - interval '30 days') * 1000;
  async cleanupOldMessages(maxAgeDays = 30) {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const { error } = await this._client
      .from('messages')
      .delete()
      .lte('ts', cutoff);
    if (error) {
      console.error('[chat] Cleanup failed:', error.message);
      return;
    }
    this._emitCurrent(); // refresh all open sessions after cleanup
  }

  _startCleanupTimer() {
    // Run once shortly after init, then every hour while the app is open.
    this.cleanupOldMessages();
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._cleanupTimer = setInterval(() => this.cleanupOldMessages(), 60 * 60 * 1000);
    this._cleanupTimer.unref?.(); // don't keep the process/tab alive
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this._cleanupTimer = null;
    for (const ch of this._channels) {
      try { this._client.removeChannel(ch); } catch { /* ignore */ }
    }
    this._channels = [];
  }
}
