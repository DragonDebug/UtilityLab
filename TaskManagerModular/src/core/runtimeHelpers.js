    function getSystemPreferredTheme() {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function formatStorageBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';

      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let value = bytes;
      let unitIndex = 0;

      while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
      }

      const digits = value >= 100 || unitIndex === 0 ? 0 : 1;
      return `${value.toFixed(digits)} ${units[unitIndex]}`;
    }

    async function updateStorageStatusCard() {
      const backendBadge = document.getElementById('storageBackendBadge');
      const usageText = document.getElementById('storageUsageText');
      const statusCaption = document.getElementById('storageStatusCaption');
      const taskCount = document.getElementById('storageTaskCount');
      const itemCount = document.getElementById('storageItemCount');
      const logCount = document.getElementById('storageLogCount');
      const templateCount = document.getElementById('storageTemplateCount');
      if (!backendBadge || !usageText || !statusCaption || !taskCount || !itemCount || !logCount || !templateCount) return;

      backendBadge.textContent = storageBackend === 'indexeddb' ? 'IndexedDB Active' : 'LocalStorage Fallback';
      taskCount.textContent = String(tasks.length);
      itemCount.textContent = String(items.length);
      logCount.textContent = String(logs.length);
      templateCount.textContent = String(templates.length);

      let usageSummary = 'Browser storage estimate unavailable.';
      if (navigator.storage?.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          const usage = Number(estimate?.usage);
          const quota = Number(estimate?.quota);
          usageSummary = Number.isFinite(usage) && Number.isFinite(quota)
            ? `${formatStorageBytes(usage)} used of ${formatStorageBytes(quota)} available for this site.`
            : Number.isFinite(usage)
              ? `${formatStorageBytes(usage)} used by this site.`
              : usageSummary;
        } catch {
          usageSummary = 'Browser storage estimate unavailable.';
        }
      }

      usageText.textContent = usageSummary;
      statusCaption.textContent = storageBackend === 'indexeddb'
        ? 'App data is stored in IndexedDB. Theme remains in localStorage so it can be applied before the page paints.'
        : 'IndexedDB is unavailable here, so Task Manager is using localStorage for persistence on this browser.';
    }

    function createBackupPayload() {
      return {
        app: 'Task Manager',
        version: 1,
        exportedAt: new Date().toISOString(),
        storageBackend,
        data: {
          tasks,
          items,
          itemSettings,
          hiddenFilters,
          logs,
          categories,
          templates,
          preferences: {
            hideDone,
            showSecondaryStats,
            activeSecondaryStatsTab,
            viewMode: currentViewMode,
            sortMode: currentSortMode,
            theme: currentTheme
          }
        }
      };
    }

    function normalizeBackupPayload(payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('The selected file is not a valid Task Manager backup.');
      }

      const data = payload.data && typeof payload.data === 'object'
        ? payload.data
        : payload;
      const preferences = data.preferences && typeof data.preferences === 'object'
        ? data.preferences
        : {};
      const theme = String(preferences.theme || '').trim() === 'light' ? 'light' : 'dark';

      return {
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        items: Array.isArray(data.items) ? data.items : [],
        itemSettings: data.itemSettings && typeof data.itemSettings === 'object' ? data.itemSettings : null,
        hiddenFilters: data.hiddenFilters && typeof data.hiddenFilters === 'object'
          ? data.hiddenFilters
          : { status: [], priority: [], category: [] },
        logs: Array.isArray(data.logs) ? data.logs : [],
        categories: Array.isArray(data.categories) ? data.categories : [],
        templates: Array.isArray(data.templates) ? data.templates : [],
        preferences: {
          hideDone: preferences.hideDone === true || preferences.hideDone === 'true' ? 'true' : 'false',
          showSecondaryStats: preferences.showSecondaryStats === false || preferences.showSecondaryStats === 'false' ? 'false' : 'true',
          activeSecondaryStatsTab: String(preferences.activeSecondaryStatsTab || 'status'),
          viewMode: String(preferences.viewMode || 'standard'),
          sortMode: String(preferences.sortMode || 'workflow'),
          theme: theme || getSystemPreferredTheme()
        }
      };
    }

    async function persistBackupPayload(snapshot) {
      const entries = [
        { key: KEYS.tasks, value: snapshot.tasks },
        { key: KEYS.items, value: snapshot.items },
        { key: KEYS.itemSettings, value: snapshot.itemSettings },
        { key: KEYS.hiddenFilters, value: snapshot.hiddenFilters },
        { key: KEYS.logs, value: snapshot.logs },
        { key: KEYS.categories, value: snapshot.categories },
        { key: KEYS.templates, value: snapshot.templates },
        { key: KEYS.hideDone, value: snapshot.preferences.hideDone },
        { key: KEYS.showSecondaryStats, value: snapshot.preferences.showSecondaryStats },
        { key: KEYS.activeSecondaryStatsTab, value: snapshot.preferences.activeSecondaryStatsTab },
        { key: KEYS.viewMode, value: snapshot.preferences.viewMode },
        { key: KEYS.sortMode, value: snapshot.preferences.sortMode }
      ];

      await flushStorageWrites();

      if (storageBackend === 'indexeddb') {
        await idbSetMany(entries);
      } else {
        entries.forEach(entry => {
          if (PERSISTED_JSON_KEYS.includes(entry.key)) {
            writeLegacyJson(entry.key, entry.value);
          } else {
            writeLegacyPreference(entry.key, entry.value);
          }
        });
      }

      writeLegacyPreference(KEYS.theme, snapshot.preferences.theme);
    }

    async function clearPersistedTaskManagerData() {
      await flushStorageWrites();

      if ('indexedDB' in window) {
        try {
          await openStorageDb();
          await idbClearAll();
        } catch (error) {
          if (storageBackend === 'indexeddb') {
            throw error;
          }
        }
      }

      Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    }

    function resetTransientUiState() {
      editingId = null;
      editingCategoryName = null;
      editingTemplateId = null;
      selectedTaskId = null;
      activeCategoryStatsPage = 0;
      activeDetailTab = 'description';
      activeDetailEditField = null;
      activeDetailEditTaskId = null;
      activeLogDateEditId = null;
      activeSubtaskEditTaskId = null;
      activeSubtaskEditId = null;
      itemSearchQuery = '';
      selectedItemIds = new Set();
      taskDraftImageDataUrl = '';
      taskDraftImageName = '';

      const taskSearchInput = document.getElementById('searchTasks');
      const categoryFilter = document.getElementById('filterCategory');
      const priorityFilter = document.getElementById('filterPriority');
      const statusFilter = document.getElementById('filterStatus');
      const itemSearchInput = document.getElementById('itemSearchInput');
      const backupInput = document.getElementById('settingsBackupInput');

      if (taskSearchInput) taskSearchInput.value = '';
      if (categoryFilter) categoryFilter.value = '';
      if (priorityFilter) priorityFilter.value = '';
      if (statusFilter) statusFilter.value = '';
      if (itemSearchInput) itemSearchInput.value = '';
      if (backupInput) backupInput.value = '';

      closeDetailContextMenu();
    }

    function renderAppState() {
      document.getElementById('sortTasks').value = currentSortMode;
      updateCompletedVisibilityToggleLabel();
      applyTaskCardImageSizePreference();
      renderTaskProjectOptions();
      renderCategoryList();
      renderTemplateList();
      renderTasks();
      renderAllItemsList();
      updateSecondaryStatsToggle();
      applyInputLimits();
      fillItemSettingsForm();
      updateStorageStatusCard();
      if (document.getElementById('reportModal')?.classList.contains('open')) {
        renderReportDashboard();
      }
    }

    async function reloadAppFromStorage(options = {}) {
      await loadState();
      if (options.resetUi !== false) {
        resetTransientUiState();
      }
      applyTheme(currentTheme);
      saveCategories();
      saveTasks();
      saveItems();
      saveItemSettings();
      saveHiddenFilters();
      saveTemplates();
      renderAppState();
    }

    function downloadBlobFile(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    async function readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Unable to read the selected file.'));
        reader.readAsText(file);
      });
    }

    function exportBackupToJson() {
      const stamp = getExportTimestampStamp();
      const payload = createBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlobFile(blob, `task-manager-backup-${stamp}.json`);
    }

    async function importBackupFromFile(file) {
      if (!file) return;

      const rawText = await readFileAsText(file);
      const parsed = JSON.parse(rawText);
      const snapshot = normalizeBackupPayload(parsed);
      const confirmed = confirm(`Replace the current Task Manager data with the contents of "${file.name}"? This will overwrite the data currently saved in this browser.`);
      if (!confirmed) return;

      await persistBackupPayload(snapshot);
      await reloadAppFromStorage();
      alert(`Backup restored from ${file.name}.`);
    }

    async function removeAllTaskManagerData() {
      const totalRecords = tasks.length + items.length + logs.length;
      const confirmed = confirm(`Remove all Task Manager data from this browser? This will delete ${tasks.length} task${tasks.length === 1 ? '' : 's'}, ${items.length} item${items.length === 1 ? '' : 's'}, ${logs.length} log${logs.length === 1 ? '' : 's'}, templates, categories, and saved preferences.`);
      if (!confirmed) return false;

      await clearPersistedTaskManagerData();
      currentTheme = getSystemPreferredTheme();
      writeLegacyPreference(KEYS.theme, currentTheme);
      await reloadAppFromStorage();
      alert(totalRecords ? 'All Task Manager data has been removed and the app was reset to a fresh state.' : 'Task Manager data was already empty. Preferences were reset.');
      return true;
    }

    function normalizeOptionList(optionList = []) {
      const values = Array.isArray(optionList)
        ? optionList
        : String(optionList || '').split(/\r?\n/);
      const seen = new Set();

      return values
        .map(value => String(value || '').trim())
        .filter(value => {
          if (!value) return false;
          const normalizedKey = value.toLowerCase();
          if (seen.has(normalizedKey)) return false;
          seen.add(normalizedKey);
          return true;
        });
    }

    function parsePositiveInteger(value, fallback) {
      const parsed = Number.parseInt(String(value ?? '').trim(), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    function clampWorkingWeekYear(value) {
      return Math.max(2000, Math.min(9999, parsePositiveInteger(value, new Date().getFullYear())));
    }

    function getWorkingWeeksInYear(year) {
      const normalizedYear = clampWorkingWeekYear(year);
      const firstWeekStart = getStartOfWeek(new Date(normalizedYear, 0, 1), WORKING_WEEK_START_DAY);
      const lastWeekStart = getStartOfWeek(new Date(normalizedYear, 11, 31), WORKING_WEEK_START_DAY);
      const firstWeekStartDayNumber = toDayNumber(firstWeekStart);
      const lastWeekStartDayNumber = toDayNumber(lastWeekStart);
      return 1 + Math.floor((lastWeekStartDayNumber - firstWeekStartDayNumber) / 7);
    }

    function clampWorkingWeekNumber(value, year) {
      const normalizedYear = clampWorkingWeekYear(year);
      const maxWeeks = getWorkingWeeksInYear(normalizedYear);
      return Math.max(1, Math.min(maxWeeks, parsePositiveInteger(value, 1)));
    }

    function normalizeOrderedKeyList(keys, allowedKeys, fallbackKeys) {
      const nextKeys = Array.isArray(keys) ? keys : [];
      const allowedKeySet = new Set(allowedKeys);
      const normalizedKeys = [];
      const seen = new Set();

      nextKeys.forEach(key => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey || seen.has(normalizedKey) || !allowedKeySet.has(normalizedKey)) return;
        normalizedKeys.push(normalizedKey);
        seen.add(normalizedKey);
      });

      fallbackKeys.forEach(key => {
        if (seen.has(key) || !allowedKeySet.has(key)) return;
        normalizedKeys.push(key);
        seen.add(key);
      });

      return normalizedKeys;
    }

    function normalizeVisibleKeyList(keys, allowedKeys, fallbackKeys) {
      const nextKeys = Array.isArray(keys) ? keys : [];
      const allowedKeySet = new Set(allowedKeys);
      const normalizedKeys = [];
      const seen = new Set();

      nextKeys.forEach(key => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey || seen.has(normalizedKey) || !allowedKeySet.has(normalizedKey)) return;
        normalizedKeys.push(normalizedKey);
        seen.add(normalizedKey);
      });

      return normalizedKeys.length ? normalizedKeys : [...fallbackKeys];
    }

    function getDetailedExportCategoryCounterKey(categoryName) {
      const normalizedName = String(categoryName || '').trim().toLowerCase();
      return normalizedName ? `category:${normalizedName}` : '';
    }

    function normalizeDetailedExportColumnSettings(settings = {}) {
      const allowedKeys = DETAILED_EXPORT_COLUMN_DEFINITIONS.map(column => column.key);
      const fallbackKeys = [...allowedKeys];

      return {
        order: normalizeOrderedKeyList(settings?.order, allowedKeys, fallbackKeys),
        visible: normalizeVisibleKeyList(settings?.visible, allowedKeys, fallbackKeys)
      };
    }

    function normalizeDetailedExportCounterSettings(settings = {}) {
      const summaryVisibility = {};
      DETAILED_EXPORT_COUNTER_SUMMARY_KEYS.forEach(counterKey => {
        summaryVisibility[counterKey] = settings?.summaryVisibility?.[counterKey] !== false;
      });

      const categoryVisibility = {};
      if (settings?.categoryVisibility && typeof settings.categoryVisibility === 'object') {
        Object.entries(settings.categoryVisibility).forEach(([categoryName, isVisible]) => {
          const normalizedCategoryName = String(categoryName || '').trim();
          const counterKey = normalizedCategoryName.toLowerCase().startsWith('category:')
            ? normalizedCategoryName.toLowerCase()
            : getDetailedExportCategoryCounterKey(normalizedCategoryName);
          if (!counterKey) return;
          categoryVisibility[counterKey] = isVisible !== false;
        });
      }

      return {
        summaryVisibility,
        categoryVisibility
      };
    }

    function normalizePositiveInteger(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.min(max, Math.max(min, parsed));
    }

    function normalizeCompletedTaskVisibilityMode(value) {
      return String(value || '').trim().toLowerCase() === 'hide-older' ? 'hide-older' : 'all';
    }

    function normalizeItemSettings(settings = {}) {
      const currentWorkingWeekInfo = getWorkingWeekInfo(new Date()) || { year: new Date().getFullYear(), weekNumber: 1 };
      const currentYear = new Date().getFullYear();
      const supplierOptions = normalizeOptionList(
        Array.isArray(settings?.supplierOptions) && settings.supplierOptions.length
          ? settings.supplierOptions
          : DEFAULT_ITEM_SUPPLIER_OPTIONS
      );
      const senderOptions = normalizeOptionList(settings?.senderOptions || []);
      const projectOptions = normalizeOptionList(settings?.projectOptions || []);
      const detailedExportWeekYear = clampWorkingWeekYear(settings?.detailedExportWeekYear ?? currentWorkingWeekInfo.year);
      const detailedExportWeekNumber = clampWorkingWeekNumber(settings?.detailedExportWeekNumber ?? currentWorkingWeekInfo.weekNumber, detailedExportWeekYear);
      const detailedExportColumns = normalizeDetailedExportColumnSettings(settings?.detailedExportColumns);
      const detailedExportCounters = normalizeDetailedExportCounterSettings(settings?.detailedExportCounters);
      const taskCardImageSize = TASK_CARD_IMAGE_SIZE_OPTIONS.includes(String(settings?.taskCardImageSize || '').trim().toLowerCase())
        ? String(settings.taskCardImageSize).trim().toLowerCase()
        : 'large';
      const completedTaskVisibilityMode = normalizeCompletedTaskVisibilityMode(settings?.completedTaskVisibilityMode);
      const completedTaskVisibleDays = normalizePositiveInteger(settings?.completedTaskVisibleDays, 30, 1, 3650);
      const completedTaskCleanupDays = normalizePositiveInteger(settings?.completedTaskCleanupDays, completedTaskVisibleDays, 1, 3650);
      const completedTaskCleanupBeforeYear = normalizePositiveInteger(settings?.completedTaskCleanupBeforeYear, currentYear, 2000, 9999);

      return {
        supplierOptions: supplierOptions.length ? supplierOptions : [...DEFAULT_ITEM_SUPPLIER_OPTIONS],
        senderOptions,
        projectOptions,
        detailedExportWeekNumber,
        detailedExportWeekYear,
        detailedExportColumns,
        detailedExportCounters,
        taskCardImageSize,
        completedTaskVisibilityMode,
        completedTaskVisibleDays,
        completedTaskCleanupDays,
        completedTaskCleanupBeforeYear
      };
    }

    function getCompletedTaskVisibilityMode() {
      return normalizeCompletedTaskVisibilityMode(itemSettings?.completedTaskVisibilityMode);
    }

    function getCompletedTaskVisibleDays() {
      return normalizePositiveInteger(itemSettings?.completedTaskVisibleDays, 30, 1, 3650);
    }

    function getCompletedTaskCleanupDays() {
      return normalizePositiveInteger(itemSettings?.completedTaskCleanupDays, getCompletedTaskVisibleDays(), 1, 3650);
    }

    function getCompletedTaskCleanupBeforeYear() {
      return normalizePositiveInteger(itemSettings?.completedTaskCleanupBeforeYear, new Date().getFullYear(), 2000, 9999);
    }

    function getTaskCardImageSizeConfig(size = itemSettings?.taskCardImageSize) {
      switch (String(size || '').trim().toLowerCase()) {
        case 'small':
          return {
            standardMin: '96px',
            standardMax: '96px',
            compactMin: '82px',
            compactMax: '82px'
          };
        case 'medium':
          return {
            standardMin: '96px',
            standardMax: '136px',
            compactMin: '82px',
            compactMax: '112px'
          };
        default:
          return {
            standardMin: '96px',
            standardMax: '176px',
            compactMin: '82px',
            compactMax: '136px'
          };
      }
    }

    function applyTaskCardImageSizePreference(size = itemSettings?.taskCardImageSize) {
      const root = document.documentElement;
      const config = getTaskCardImageSizeConfig(size);

      root.style.setProperty('--task-card-media-min-width', config.standardMin);
      root.style.setProperty('--task-card-media-max-width', config.standardMax);
      root.style.setProperty('--task-card-media-max-height', config.standardMax);
      root.style.setProperty('--task-card-media-compact-min-width', config.compactMin);
      root.style.setProperty('--task-card-media-compact-max-width', config.compactMax);
      root.style.setProperty('--task-card-media-compact-max-height', config.compactMax);
    }

    function getSupplierOptions(extraValue = '') {
      return normalizeOptionList([...(itemSettings?.supplierOptions || DEFAULT_ITEM_SUPPLIER_OPTIONS), extraValue]);
    }

    function getProjectOptions(extraValue = '') {
      return normalizeOptionList([
        ...(itemSettings?.projectOptions || []),
        ...(tasks || []).map(task => task?.project || ''),
        extraValue
      ]);
    }

    function getSenderOptions(extraValue = '') {
      return normalizeOptionList([...(itemSettings?.senderOptions || []), extraValue]);
    }

    function getDefaultItemSupplier() {
      return getSupplierOptions()[0] || '';
    }

    // ── State ──
    // In-memory arrays kept in sync with persisted storage via the save* helpers.
    // selectedTaskId tracks which card is active / shown in the detail panel.
