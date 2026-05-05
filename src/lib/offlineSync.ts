// Lightweight offline write-queue using IndexedDB.
// Wraps mutations: when offline, push to queue; on reconnect, replay.
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DB_NAME = 'cungacash_offline';
const STORE = 'queue';

interface QueuedOp {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload: any;
  match?: Record<string, any>;
  ts: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => void) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueue(op: Omit<QueuedOp, 'id' | 'ts'>) {
  const item: QueuedOp = { ...op, id: crypto.randomUUID(), ts: Date.now() };
  await withStore('readwrite', s => { s.add(item); });
  return item;
}

export async function getQueue(): Promise<QueuedOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedOp[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeFromQueue(id: string) {
  await withStore('readwrite', s => { s.delete(id); });
}

export async function replayQueue() {
  if (!navigator.onLine) return;
  const queue = await getQueue();
  if (queue.length === 0) return;
  let ok = 0, fail = 0;
  for (const item of queue) {
    try {
      const t = supabase.from(item.table as any);
      let res;
      if (item.op === 'insert') res = await t.insert(item.payload);
      else if (item.op === 'update') {
        let q = t.update(item.payload);
        for (const [k, v] of Object.entries(item.match ?? {})) q = q.eq(k, v);
        res = await q;
      } else if (item.op === 'delete') {
        let q = t.delete();
        for (const [k, v] of Object.entries(item.match ?? {})) q = q.eq(k, v);
        res = await q;
      }
      if (res?.error) throw res.error;
      await removeFromQueue(item.id);
      ok++;
    } catch (e) {
      fail++;
      console.error('Replay failed for', item, e);
    }
  }
  if (ok > 0) toast.success(`Synced ${ok} offline change${ok > 1 ? 's' : ''}`);
  if (fail > 0) toast.error(`${fail} offline change(s) failed to sync`);
}

export function initOfflineSync() {
  window.addEventListener('online', () => {
    toast.success('Back online — syncing your changes…');
    replayQueue();
  });
  window.addEventListener('offline', () => toast.warning('You are offline. Changes are being saved locally.'));
  // Attempt initial replay on load
  setTimeout(() => replayQueue(), 1500);
}

export function useOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
