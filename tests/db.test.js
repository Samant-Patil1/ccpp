import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, isPlaceholderConfig } from '../js/db.js';

function fakeKv() {
  const store = new Map();
  const cbs = new Set();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    subscribe: (cb) => { cbs.add(cb); return () => cbs.delete(cb); },
    external(key) { for (const cb of cbs) cb(key); },
  };
}

test('isPlaceholderConfig detects the placeholder Supabase config', () => {
  assert.equal(
    isPlaceholderConfig({ supabaseUrl: 'https://PASTE_PROJECT_REF.supabase.co', supabaseAnonKey: 'PASTE_ANON_KEY_HERE' }),
    true,
  );
  assert.equal(isPlaceholderConfig(null), true);
});

test('falls back to the local backend when Supabase cannot be reached', async () => {
  const { backend, mode } = await createBackend('S', fakeKv());
  assert.equal(mode, 'local');
  assert.equal(backend.kind, 'local');
});

test('messages sent by one tab are immediately visible to the other tab', async () => {
  const kv = fakeKv();
  const sender = await createBackend('S', kv);
  const viewer = await createBackend('I', kv);

  const seen = [];
  viewer.backend.subscribeMessages((m) => seen.push(m));

  await sender.backend.sendMessage({ from: 'S', type: 'text', text: 'hi there', replyTo: null });
  kv.external('si.messages'); // browsers fire `storage` in other tabs automatically
  assert.equal(seen.at(-1)[0].text, 'hi there');
});
