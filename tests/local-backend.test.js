import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalBackend } from '../js/db/local-backend.js';

function makeKv() {
  const store = new Map();
  const cbs = new Set();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    subscribe: (cb) => { cbs.add(cb); return () => cbs.delete(cb); },
    external(key) { for (const cb of cbs) cb(key); }, // simulate a storage event from another tab
  };
}

test('init reports connection and current messages', async () => {
  const kv = makeKv();
  const a = new LocalBackend(kv);
  const conn = [];
  a.onConnection((c) => conn.push(c));
  const snapshots = [];
  a.subscribeMessages((m) => snapshots.push([...m]));
  await a.init();
  assert.deepEqual(conn, [true]);
  assert.deepEqual(snapshots.at(-1), []);
});

test('sendMessage persists, fills id/ts, and notifies subscribers', async () => {
  const kv = makeKv();
  const a = new LocalBackend(kv);
  await a.init();
  const seen = [];
  a.subscribeMessages((m) => seen.push(m));
  const msg = await a.sendMessage({ from: 'S', type: 'text', text: 'hi', replyTo: null });
  assert.equal(msg.text, 'hi');
  assert.ok(msg.id && typeof msg.ts === 'number');
  assert.equal(seen.at(-1).length, 1);
  assert.equal(seen.at(-1)[0].text, 'hi');
});

test('a second instance sees messages after an external storage event', async () => {
  const kv = makeKv();
  const a = new LocalBackend(kv);
  const b = new LocalBackend(kv);
  await a.init();
  await b.init();
  const seen = [];
  b.subscribeMessages((m) => seen.push(m));
  await a.sendMessage({ from: 'I', type: 'text', text: 'yo', replyTo: null });
  kv.external('si.messages');
  assert.equal(seen.at(-1)[0].text, 'yo');
});

test('messages persist across re-instantiation (same kv)', async () => {
  const kv = makeKv();
  const a = new LocalBackend(kv);
  await a.init();
  await a.sendMessage({ from: 'S', type: 'text', text: 'still here', replyTo: null });
  const b = new LocalBackend(kv); // "reopen the browser"
  await b.init();
  const seen = [];
  b.subscribeMessages((m) => seen.push(m));
  assert.equal(seen.at(-1)[0].text, 'still here');
});

test('unsubscribe stops notifications', async () => {
  const kv = makeKv();
  const a = new LocalBackend(kv);
  await a.init();
  let n = 0;
  const off = a.subscribeMessages(() => n++);
  n = 0; // ignore the immediate snapshot call
  off();
  await a.sendMessage({ from: 'S', type: 'text', text: 'x', replyTo: null });
  assert.equal(n, 0);
});
