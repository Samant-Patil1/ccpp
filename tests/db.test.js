import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from '../js/db.js';

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

test('createBackend wires the local backend and reports local mode', async () => {
  const { backend, local } = await createBackend('S', fakeKv());
  assert.equal(local, true);
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
