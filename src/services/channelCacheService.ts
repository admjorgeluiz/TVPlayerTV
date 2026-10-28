import { Channel } from '../types/iptv';

const DB_NAME = 'TVPlayerTizenDB';
const DB_VERSION = 1;
const STORE_NAME = 'playlist_cache';
const CACHE_KEY = 'saved_channels_v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cache local em IndexedDB (equivalente ao Room Database channels_cache do TVPlayer-main Android).
 * Permite abrir listas de 30.000+ canais instantaneamente ao ligar a TV, sem baixar tudo de novo!
 */
export const channelCacheService = {
  async saveChannels(url: string, channels: Channel[]): Promise<void> {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ url, updatedAt: Date.now(), channels }, CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn('[ChannelCache] Aviso ao salvar cache IndexedDB:', e);
    }
  },

  async loadCachedChannels(expectedUrl?: string): Promise<{ url: string; channels: Channel[] } | null> {
    try {
      const db = await openDb();
      const result = await new Promise<{ url: string; channels: Channel[] } | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(CACHE_KEY);
        req.onsuccess = () => {
          const data = req.result;
          if (data && Array.isArray(data.channels) && data.channels.length > 0) {
            if (!expectedUrl || data.url === expectedUrl) {
              resolve({ url: data.url, channels: data.channels });
              return;
            }
          }
          resolve(null);
        };
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    } catch {
      return null;
    }
  },

  async clearCache(): Promise<void> {
    try {
      const db = await openDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(CACHE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      db.close();
    } catch {
      // Ignorar
    }
  },
};
