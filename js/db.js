import { LocalBackend } from './db/local-backend.js';

// The only backend: a localStorage-backed store. Messages live in the
// browser's localStorage — after every message the whole store is
// re-serialised to JSON (timestamp, sender and content included) — so the
// static GitHub Pages site works with no server at all. Two tabs can chat
// simultaneously; each tab keeps its own signed-in user.
export async function createBackend(me, kv) {
  const backend = new LocalBackend(kv, me);
  await backend.init();
  return { backend, local: true };
}
