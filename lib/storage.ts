/**
 * Storage abstraction that works in both browser (Web) and Capacitor (iOS/Android).
 * On web: uses localStorage / sessionStorage.
 * On native: uses @capacitor/preferences (async key-value store).
 *
 * Note: The sync API (storage.get/set/remove) always uses localStorage for web.
 * Use storageAsync.* for Capacitor-native async access.
 */

const isClient = typeof window !== 'undefined';

// ---------- Sync (Web only — safe to call anywhere) ----------

export const storage = {
  get: (key: string): string | null =>
    isClient ? localStorage.getItem(key) : null,
  set: (key: string, val: string): void => {
    if (isClient) localStorage.setItem(key, val);
  },
  remove: (key: string): void => {
    if (isClient) localStorage.removeItem(key);
  },
};

export const sessionStore = {
  get: (key: string): string | null =>
    isClient ? sessionStorage.getItem(key) : null,
  set: (key: string, val: string): void => {
    if (isClient) sessionStorage.setItem(key, val);
  },
  remove: (key: string): void => {
    if (isClient) sessionStorage.removeItem(key);
  },
};

// ---------- Async (Capacitor-aware) ----------

function isNative(): boolean {
  try {
    // Capacitor is only available when the app runs inside a native shell
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Capacitor } = require('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function getPreferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

export const storageAsync = {
  get: async (key: string): Promise<string | null> => {
    if (isNative()) {
      const P = await getPreferences();
      const { value } = await P.get({ key });
      return value;
    }
    return storage.get(key);
  },
  set: async (key: string, val: string): Promise<void> => {
    if (isNative()) {
      const P = await getPreferences();
      await P.set({ key, value: val });
    } else {
      storage.set(key, val);
    }
  },
  remove: async (key: string): Promise<void> => {
    if (isNative()) {
      const P = await getPreferences();
      await P.remove({ key });
    } else {
      storage.remove(key);
    }
  },
};

export const sessionStoreAsync = {
  get: async (key: string): Promise<string | null> => {
    if (isNative()) {
      // Sessions are scoped to app launch on native — use Preferences with a prefix
      const P = await getPreferences();
      const { value } = await P.get({ key: `_session_${key}` });
      return value;
    }
    return sessionStore.get(key);
  },
  set: async (key: string, val: string): Promise<void> => {
    if (isNative()) {
      const P = await getPreferences();
      await P.set({ key: `_session_${key}`, value: val });
    } else {
      sessionStore.set(key, val);
    }
  },
  remove: async (key: string): Promise<void> => {
    if (isNative()) {
      const P = await getPreferences();
      await P.remove({ key: `_session_${key}` });
    } else {
      sessionStore.remove(key);
    }
  },
};
