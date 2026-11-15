/**
 * Accounts and cloud-saved progress (Supabase).
 *
 * The game keeps working entirely from browser storage. When Supabase is configured and the
 * learner is signed in, every `wayword.*` key is mirrored to one row per learner, so progress
 * follows them to another device. Without configuration (or under automated tests) nothing here
 * runs, and the site behaves exactly as before.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

// Read from the project root's .env.local (see supabase/README.md). Missing outside Vite, e.g. in unit tests.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
/** Automated browsers (Playwright) always use the local demo, so tests never touch real accounts. */
export const cloudEnabled = !!url && !!anonKey && !(typeof navigator !== 'undefined' && navigator.webdriver);

const table = 'learner_progress';
let client: Promise<SupabaseClient> | undefined;
function supabase() {
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, anonKey!));
  return client;
}

export type Snapshot = Record<string, string>;
/** Learner data to sync: everything the game saves, minus a throwaway storage probe. */
const synced = (key: string) => key.startsWith('wayword.') && key !== 'wayword.storage-check';

export function readSnapshot(storage: Storage): Snapshot {
  const snapshot: Snapshot = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && synced(key)) snapshot[key] = storage.getItem(key) ?? '';
  }
  return snapshot;
}

/**
 * Combine this browser's data with the account's. Lists (completed chapters, traced letters,
 * visited stalls) are merged so progress is never lost; for single values this browser wins,
 * and anything only the account has is filled in.
 */
export function mergeSnapshots(local: Snapshot, cloud: Snapshot): Snapshot {
  const merged: Snapshot = { ...cloud, ...local };
  for (const key of Object.keys(cloud)) {
    if (!(key in local)) continue;
    try {
      const a: unknown = JSON.parse(local[key]), b: unknown = JSON.parse(cloud[key]);
      if (Array.isArray(a) && Array.isArray(b)) merged[key] = JSON.stringify([...a, ...b.filter(item => !a.some(other => JSON.stringify(other) === JSON.stringify(item)))]);
    } catch { /* Not JSON: keep this browser's value. */ }
  }
  return merged;
}

export async function currentUser(): Promise<User | null> {
  if (!cloudEnabled) return null;
  try { return (await (await supabase()).auth.getSession()).data.session?.user ?? null; } catch { return null; }
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await (await supabase()).auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: `${location.origin}/auth/` } });
  if (error) throw error;
  // With email confirmation switched on, there is no session until the link is clicked.
  return { needsConfirmation: !data.session };
}
export async function signIn(email: string, password: string) {
  const { error } = await (await supabase()).auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() {
  await (await supabase()).auth.signOut();
}
export async function sendPasswordReset(email: string) {
  const { error } = await (await supabase()).auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/` });
  if (error) throw error;
}

let lastPushed = '';
let started = false;
async function push(userId: string) {
  const snapshot = readSnapshot(localStorage), body = JSON.stringify(snapshot);
  if (body === lastPushed) return;
  const { error } = await (await supabase()).from(table).upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() });
  if (!error) lastPushed = body;
}

/**
 * Pull the account's progress into this browser, then keep pushing changes.
 * Resolves after the first pull (or after `timeout` ms), so pages can render with the latest progress.
 */
export async function startCloudSync(timeout = 2500): Promise<void> {
  if (!cloudEnabled || started) return;
  const pull = (async () => {
    const user = await currentUser();
    // Not signed in yet: try again after sign-in (the sign-in page calls this once more).
    if (!user || started) return;
    started = true;
    const db = await supabase();
    const { data } = await db.from(table).select('data').eq('user_id', user.id).maybeSingle();
    const merged = mergeSnapshots(readSnapshot(localStorage), (data?.data ?? {}) as Snapshot);
    for (const [key, value] of Object.entries(merged)) if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
    await push(user.id);
    // Save as you play, and once more when the page is hidden or closed.
    const save = () => { void push(user.id); };
    setInterval(save, 15000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);
  })().catch(() => { /* Offline or misconfigured: the browser copy still works. */ });
  await Promise.race([pull, new Promise(resolve => setTimeout(resolve, timeout))]);
}

/** Save right now (used before leaving a page after an important step). */
export async function saveNow() {
  const user = await currentUser();
  if (user) await push(user.id).catch(() => {});
}
