// Supabase backend — persists every message in the `messages` table and
// streams inserts to every open session, so all users see the same
// conversation no matter which device or browser they use.
//
// Loaded dynamically (an ES module from a CDN) so that a failure to load
// the SDK degrades to the local backend instead of crashing the app.

const CHANNEL_NAME = 'chat-room';

export class SupabaseBackend {
  constructor(config, me = '') {
    this.config = config;
    this.me = me;
    this.kind = 'supabase';
    this._client = null;
    this._channels = [];
    this._msgCbs = new Set();
    this._connCbs = new Set();
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
  }

  async sendMessage(partial) {
    const { error } = await this._client
      .from('messages')
      .insert({
        from: this.me,
        type: partial.type,
        text: partial.text ?? null,
        dataUrl: partial.dataUrl ?? null,
        fileName: partial.fileName ?? null,
        fileSize: partial.fileSize ?? null,
        mime: partial.mime ?? null,
        replyTo: partial.replyTo ?? null,
        ts: Date.now(),
      });
    if (error) throw new Error(error.message);
    return { ...partial, ts: Date.now() };
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
    for (const cb of this._msgCbs) cb(data ?? []);
  }

  _emitMessages() {
    this._emitCurrent();
  }

  _emitConn(online) {
    for (const cb of this._connCbs) cb(online);
  }
}
