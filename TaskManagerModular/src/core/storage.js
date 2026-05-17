    // ── Storage Keys ──
    // Centralised localStorage key names so they never get mis-typed elsewhere.
    const KEYS = {
      tasks: 'tm_tasks',
      items: 'tm_items',
      itemSettings: 'tm_item_settings',
      hiddenFilters: 'tm_hidden_filters',
      logs: 'tm_logs',
      categories: 'tm_categories',
      templates: 'tm_templates',
      hideDone: 'tm_hide_done',
      viewMode: 'tm_view_mode',
      sortMode: 'tm_sort_mode',
      theme: 'tm_theme',
      showSecondaryStats: 'tm_show_secondary_stats',
      activeSecondaryStatsTab: 'tm_active_secondary_stats_tab'
    };

    const STORAGE_DB = {
      name: 'task-manager-db',
      version: 1,
      storeName: 'task-manager-state',
      migratedKey: '__tm_local_storage_migrated__'
    };
    const PERSISTED_JSON_KEYS = [
      KEYS.tasks,
      KEYS.items,
      KEYS.itemSettings,
      KEYS.hiddenFilters,
      KEYS.logs,
      KEYS.categories,
      KEYS.templates
    ];
    const PERSISTED_PREFERENCE_KEYS = [
      KEYS.hideDone,
      KEYS.viewMode,
      KEYS.sortMode,
      KEYS.showSecondaryStats,
      KEYS.activeSecondaryStatsTab
    ];
    const PERSISTED_IDB_KEYS = [...PERSISTED_JSON_KEYS, ...PERSISTED_PREFERENCE_KEYS];

    let storageBackend = 'localStorage';
    let storageDbPromise = null;
    let storageInitPromise = null;
    let storageWriteQueue = Promise.resolve();
    let hasShownStorageAlert = false;

    function readLegacyJson(key, fallback) {
      try {
        const rawValue = localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : fallback;
      } catch {
        return fallback;
      }
    }

    function writeLegacyJson(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }

    function readLegacyPreference(key, fallback = null) {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    }

    function writeLegacyPreference(key, value) {
      localStorage.setItem(key, String(value));
    }

    function notifyStorageError(message, error) {
      console.error(message, error);
      if (hasShownStorageAlert) return;
      hasShownStorageAlert = true;
      alert('Task Manager could not use IndexedDB. The app will keep using localStorage on this browser.');
    }

    function openStorageDb() {
      if (storageDbPromise) {
        return storageDbPromise;
      }

      if (!('indexedDB' in window)) {
        return Promise.reject(new Error('IndexedDB is not available in this browser.'));
      }

      storageDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(STORAGE_DB.name, STORAGE_DB.version);

        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORAGE_DB.storeName)) {
            database.createObjectStore(STORAGE_DB.storeName, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => database.close();
          resolve(database);
        };

        request.onerror = () => {
          storageDbPromise = null;
          reject(request.error || new Error('IndexedDB failed to open.'));
        };

        request.onblocked = () => {
          storageDbPromise = null;
          reject(new Error('IndexedDB open request was blocked.'));
        };
      });

      return storageDbPromise;
    }

    async function idbGet(key) {
      const database = await openStorageDb();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORAGE_DB.storeName, 'readonly');
        const store = transaction.objectStore(STORAGE_DB.storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
        request.onerror = () => reject(request.error || new Error(`IndexedDB read failed for ${key}.`));
      });
    }

    async function idbSet(key, value) {
      const database = await openStorageDb();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORAGE_DB.storeName, 'readwrite');
        const store = transaction.objectStore(STORAGE_DB.storeName);
        store.put({ key, value });

        transaction.oncomplete = () => resolve(value);
        transaction.onerror = () => reject(transaction.error || new Error(`IndexedDB write failed for ${key}.`));
        transaction.onabort = () => reject(transaction.error || new Error(`IndexedDB write was aborted for ${key}.`));
      });
    }

    async function idbSetMany(entries = []) {
      if (!entries.length) return;

      const database = await openStorageDb();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORAGE_DB.storeName, 'readwrite');
        const store = transaction.objectStore(STORAGE_DB.storeName);

        entries.forEach(({ key, value }) => {
          store.put({ key, value });
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB batch write failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB batch write was aborted.'));
      });
    }

    async function idbClearAll() {
      const database = await openStorageDb();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORAGE_DB.storeName, 'readwrite');
        const store = transaction.objectStore(STORAGE_DB.storeName);
        store.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB clear failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB clear was aborted.'));
      });
    }

    async function hasIndexedDbData() {
      const values = await Promise.all(PERSISTED_IDB_KEYS.map(key => idbGet(key)));
      return values.some(value => value !== undefined);
    }

    async function migrateLocalStorageToIndexedDb() {
      const alreadyMigrated = await idbGet(STORAGE_DB.migratedKey);
      if (alreadyMigrated) return;

      if (await hasIndexedDbData()) {
        await idbSet(STORAGE_DB.migratedKey, true);
        return;
      }

      const entries = [];

      PERSISTED_JSON_KEYS.forEach(key => {
        const rawValue = localStorage.getItem(key);
        if (rawValue === null) return;

        try {
          entries.push({ key, value: JSON.parse(rawValue) });
        } catch {
          console.warn(`Skipping invalid localStorage JSON during migration for ${key}.`);
        }
      });

      PERSISTED_PREFERENCE_KEYS.forEach(key => {
        const rawValue = localStorage.getItem(key);
        if (rawValue === null) return;
        entries.push({ key, value: rawValue });
      });

      if (entries.length) {
        await idbSetMany(entries);
      }

      await idbSet(STORAGE_DB.migratedKey, true);
    }

    async function initializePersistence() {
      if (storageInitPromise) {
        return storageInitPromise;
      }

      storageInitPromise = (async () => {
        if (!('indexedDB' in window)) {
          storageBackend = 'localStorage';
          return;
        }

        try {
          await openStorageDb();
          await migrateLocalStorageToIndexedDb();
          storageBackend = 'indexeddb';
        } catch (error) {
          storageBackend = 'localStorage';
          notifyStorageError('IndexedDB initialization failed.', error);
        }
      })();

      return storageInitPromise;
    }

    function enqueuePersistentWrite(operation, key) {
      storageWriteQueue = storageWriteQueue
        .catch(() => undefined)
        .then(async () => {
          try {
            return await operation();
          } catch (error) {
            notifyStorageError(`Unable to save ${key}.`, error);
            throw error;
          }
        });

      return storageWriteQueue.catch(() => undefined);
    }

    async function flushStorageWrites() {
      try {
        await storageWriteQueue;
      } catch {
        // Ignore previous write failures here; callers will handle the next action.
      }
    }

    async function loadJson(key, fallback) {
      if (storageBackend !== 'indexeddb') {
        return readLegacyJson(key, fallback);
      }

      try {
        const storedValue = await idbGet(key);
        return storedValue === undefined ? fallback : storedValue;
      } catch (error) {
        notifyStorageError(`Unable to load ${key}.`, error);
        return readLegacyJson(key, fallback);
      }
    }

    function saveJson(key, value) {
      if (storageBackend !== 'indexeddb') {
        writeLegacyJson(key, value);
        return Promise.resolve(value);
      }

      return enqueuePersistentWrite(() => idbSet(key, value), key);
    }

    async function loadPreference(key, fallback = null) {
      if (key === KEYS.theme || storageBackend !== 'indexeddb') {
        return readLegacyPreference(key, fallback);
      }

      try {
        const storedValue = await idbGet(key);
        return storedValue === undefined || storedValue === null ? fallback : String(storedValue);
      } catch (error) {
        notifyStorageError(`Unable to load ${key}.`, error);
        return readLegacyPreference(key, fallback);
      }
    }

    function savePreference(key, value) {
      if (key === KEYS.theme || storageBackend !== 'indexeddb') {
        writeLegacyPreference(key, value);
        return Promise.resolve(String(value));
      }

      return enqueuePersistentWrite(() => idbSet(key, String(value)), key);
    }

