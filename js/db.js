import { LocalBackend } from './db/local-backend.js';
import { SupabaseBackend } from './db/supabase-backend.js';
import { supabaseConfig } from './supabase-config.js';

export function isPlaceholderConfig(cfg) {
  if (!cfg || typeof cfg.supabaseUrl !== 'string' || typeof cfg.supabaseAnonKey !== 'string') return true;
  return cfg.supabaseUrl.includes('PASTE') || cfg.supabaseAnonKey.includes('PASTE');
}

// Picks the Supabase backend when it is configured, and the localStorage
// backend as a fallback otherwise — so the static GitHub Pages site keeps
// working without any credentials. Any failure to initialize the remote
// backend degrades to local mode rather than crashing the app.
export async function createBackend(me, kv) {
  const config = supabaseConfig;
  if (isPlaceholderConfig(config)) {
    const backend = new LocalBackend(kv, me);
    await backend.init();
    return { backend, mode: 'local' };
  }
  try {
    const backend = new SupabaseBackend(config, me);
    await backend.init();
    return { backend, mode: 'remote' };
  } catch (err) {
    console.error('[chat] Supabase unavailable, falling back to local mode:', err);
    const backend = new LocalBackend(kv, me);
    await backend.init();
    return { backend, mode: 'local' };
  }
}
