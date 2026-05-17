    let tasks       = [];
    let items       = [];
    let logs        = [];
    let categories  = [];
    let templates   = [];
    let itemSettings = null;
    let hiddenFilters = { status: [], priority: [], category: [] };
    let hideDone    = false;
    let showSecondaryStats = true;
    let currentTheme = 'dark';
    let currentViewMode = 'standard';
    let currentSortMode = 'workflow';
    let currentTableSort = { column: '', direction: 'asc' };
    let editingId   = null;
    let editingCategoryName = null;
    let editingTemplateId = null;
    let selectedTaskId = null;
    let activeSecondaryStatsTab = 'status';
    let activeCategoryStatsPage = 0;
    let activeDetailTab = 'description';
    let activeDetailEditField = null;
    let activeDetailEditTaskId = null;
    let activeLogDateEditId = null;
    let activeSubtaskEditTaskId = null;
    let activeSubtaskEditId = null;
    let currentReportPeriod = 'monthly';
    let itemSearchQuery = '';
    let selectedItemIds = new Set();
    let taskDraftImageDataUrl = '';
    let taskDraftImageName = '';
    let renderedTaskOrderIds = [];
    let hasDeferredTaskSort = false;

    const INPUT_LIMITS = {
      searchTasks: 120,
      taskTitle: 1200,
      taskEmailSubject: 180,
      taskDescription: 2400,
      taskProject: 60,
      taskNotes: 3000,
      categoryName: 40,
      templateName: 60,
      templateSubtasks: 2000,
      subtaskTitle: 800,
      logContent: 1000,
    };

    const TASK_CARD_IMAGE_SIZE_OPTIONS = ['small', 'medium', 'large'];

    function normalizeTaskProgressPercent(value) {
      if (value === null || value === undefined || String(value).trim() === '') return 0;
      const parsed = Number.parseInt(String(value).trim(), 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.max(0, Math.min(100, parsed));
    }

    function formatTaskProgressLabel(value) {
      const normalizedValue = normalizeTaskProgressPercent(value);
      return `${normalizedValue}%`;
    }

    const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low', 'Very Low'];
    const STATUS_OPTIONS = ['Not Started','Pending','Ongoing', 'Waiting for Someone Else', 'Completed'];
    const YES_NO_OPTIONS = ['Yes', 'No'];
    const HIDDEN_FILTER_GROUPS = ['status', 'priority', 'category'];
    const TASK_VIEW_OPTIONS = ['standard', 'compact', 'table'];
    const TASK_SORT_OPTIONS = ['workflow', 'due-date', 'received-date', 'created-date', 'priority', 'title'];
    const DETAILED_EXPORT_COUNTER_SUMMARY_DEFINITIONS = [
      { key: 'openTasks', label: 'Open Tasks', accent: '1D4ED8' },
      { key: 'ongoing', label: 'Ongoing', accent: '1D4ED8' },
      { key: 'overdue', label: 'Overdue', accent: 'DC2626' }
    ];
    const DETAILED_EXPORT_COUNTER_SUMMARY_KEYS = DETAILED_EXPORT_COUNTER_SUMMARY_DEFINITIONS.map(counter => counter.key);
    const DETAILED_EXPORT_COLUMN_DEFINITIONS = [
      { key: 'No', label: 'No.', header: 'No.', width: 8, center: true },
      { key: 'TaskImage', label: 'Task Image', header: 'Task Image', width: 30, center: true, isImage: true },
      { key: 'Title', label: 'Title', header: 'Title', width: 35 },
      { key: 'Description', label: 'Description', header: 'Description', width: 50 },
      { key: 'Category', label: 'Category', header: 'Category', width: 12, center: true, validationList: 'categories' },
      { key: 'Priority', label: 'Priority', header: 'Priority', width: 12, center: true, validationList: 'priorities' },
      { key: 'EmailSubject', label: 'Email Subject', header: 'Email Subject', width: 30 },
      { key: 'Sender', label: 'Sender', header: 'Sender', width: 15, validationList: 'senders' },
      { key: 'Created', label: 'Created', header: 'Created', width: 12, center: true, isDate: true },
      { key: 'Received', label: 'Received', header: 'Received', width: 12, center: true, isDate: true },
      { key: 'Due', label: 'Due', header: 'Due', width: 12, center: true, isDate: true },
      { key: 'Started', label: 'Started', header: 'Started', width: 12, center: true, isDate: true },
      { key: 'Completed', label: 'Completed', header: 'Completed', width: 12, center: true, isDate: true },
      { key: 'Quantity', label: 'Quantity', header: 'Quantity', width: 12, center: true },
      { key: 'Status', label: 'Status', header: 'Status', width: 15, center: true, validationList: 'statuses' },
      { key: 'Notes', label: 'Notes', header: 'Notes', width: 30 },
      { key: 'LatestUpdates', label: 'Latest Updates', header: 'Latest Updates', width: 56 }
    ];

    function getDetailedExportColumnDefinition(columnKey) {
      return DETAILED_EXPORT_COLUMN_DEFINITIONS.find(column => column.key === columnKey) || null;
    }

    function getConfiguredDetailedExportColumns(settings = itemSettings) {
      const normalizedSettings = normalizeDetailedExportColumnSettings(settings?.detailedExportColumns);
      const visibleKeySet = new Set(normalizedSettings.visible);

      return normalizedSettings.order
        .filter(columnKey => visibleKeySet.has(columnKey))
        .map(columnKey => getDetailedExportColumnDefinition(columnKey))
        .filter(Boolean);
    }

    function getDetailedExportCounterOptions() {
      return [
        ...DETAILED_EXPORT_COUNTER_SUMMARY_DEFINITIONS,
        ...categories.map(category => ({
          key: getDetailedExportCategoryCounterKey(category.name),
          label: category.name,
          accent: normalizeExcelHexColor(category.color),
          categoryName: category.name
        }))
      ];
    }

    function getConfiguredDetailedExportCounterKeys(settings = itemSettings) {
      const normalizedSettings = normalizeDetailedExportCounterSettings(settings?.detailedExportCounters);
      const visibleKeys = [];

      DETAILED_EXPORT_COUNTER_SUMMARY_KEYS.forEach(counterKey => {
        if (normalizedSettings.summaryVisibility[counterKey] !== false) {
          visibleKeys.push(counterKey);
        }
      });

      categories.forEach(category => {
        const counterKey = getDetailedExportCategoryCounterKey(category.name);
        if (!counterKey) return;
        if (normalizedSettings.categoryVisibility[counterKey] !== false) {
          visibleKeys.push(counterKey);
        }
      });

      return visibleKeys;
    }

    function getDetailedExportCenterColumns(columns = []) {
      return columns.reduce((centerColumns, column, index) => {
        if (column.center) {
          centerColumns.push(index + 1);
        }
        return centerColumns;
      }, []);
    }

    function getDetailedExportDateColumnKeys(columns = []) {
      return columns.filter(column => column.isDate).map(column => column.key);
    }

    function getDetailedExportImageColumnKey(columns = []) {
      return columns.find(column => column.isImage)?.key || '';
    }

    const TASK_TABLE_COLUMNS = [
      { key: 'title', label: 'Title', width: '560px', headerClass: 'is-title', cellClass: 'is-title', sortable: true },
      { key: 'category', label: 'Category', width: '108px', sortable: true },
      { key: 'priority', label: 'Priority', width: '102px', sortable: true },
      { key: 'status', label: 'Status', width: '112px', sortable: true },
      { key: 'description', label: 'Description', width: '460px', cellClass: 'is-description', sortable: true },
      { key: 'quantity', label: 'Qty', width: '50px', sortable: true },
      { key: 'sender', label: 'Sender', width: '136px', sortable: true },
      { key: 'project', label: 'Project', width: '150px', sortable: true },
      { key: 'receivedAt', label: 'Received', width: '92px', sortable: true },
      { key: 'startedAt', label: 'Started', width: '92px', sortable: true },
      { key: 'completedAt', label: 'Completed', width: '102px', sortable: true },
      { key: 'actions', label: 'Actions', width: '88px', headerClass: 'is-actions', cellClass: 'is-actions', sortable: false }
    ];
    const DEFAULT_PRIORITY = 'Medium';
    const DEFAULT_STATUS = 'Not Started';
    const LEGACY_STATUS_ALIASES = {
      Done: 'Completed'
    };
    const ATTENTION_PRIORITIES = new Set(['Critical', 'High']);
    const PRIORITY_ORDER = Object.fromEntries(PRIORITY_OPTIONS.map((priority, index) => [priority, index]));
    const STATUS_ACCENTS = {
      'Not Started': 'var(--status-not-started)',
      Pending: 'var(--status-pending)',
      Ongoing: 'var(--status-ongoing)',
      'Waiting for Someone Else': 'var(--status-waiting)',
      Completed: 'var(--status-done)'
    };
    const PRIORITY_ACCENTS = {
      Critical: 'var(--critical)',
      High: 'var(--high)',
      Medium: 'var(--medium)',
      Low: 'var(--low)',
      'Very Low': 'var(--very-low)'
    };
    const STATUS_ORDER = {
      Ongoing: 0,
      Pending: 1,
      'Waiting for Someone Else': 2,
      'Not Started': 3,
      Completed: 4
    };

    const DEFAULT_ITEM_SUPPLIER_OPTIONS = ['Supplier A', 'Supplier B', 'Supplier C'];
    const ITEM_STATUS_OPTIONS = ['110', '235'];
    const DEFAULT_ITEM_STATUS = ITEM_STATUS_OPTIONS[0] || '';
    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const EXCEL_DATE_EPOCH_DAY_NUMBER = Math.floor(Date.UTC(1899, 11, 30) / MS_PER_DAY);
    const WORKING_WEEK_START_DAY = 0;
    const WORKING_WEEK_LENGTH_DAYS = 5;
    const INPUT_FIELDS_WITHOUT_COUNTER = new Set(['searchTasks', 'categoryName']);

    function updateInputCounter(field, counter, limit) {
      const currentLength = field.value.length;
      counter.textContent = `${currentLength}/${limit}`;
      counter.classList.toggle('is-near-limit', currentLength >= Math.floor(limit * 0.85) && currentLength < limit);
      counter.classList.toggle('is-at-limit', currentLength >= limit);
    }

    function ensureInputCounterForField(field, counterKey, limit) {
      if (!field || !counterKey || !Number.isFinite(limit)) return;

      field.maxLength = limit;

      if (INPUT_FIELDS_WITHOUT_COUNTER.has(counterKey)) {
        const existingWrapper = field.parentElement?.classList.contains('input-counter-wrap')
          ? field.parentElement
          : null;
        const existingCounter = existingWrapper?.querySelector(`.input-counter[data-for="${counterKey}"]`);

        existingCounter?.remove();

        if (existingWrapper) {
          existingWrapper.insertAdjacentElement('beforebegin', field);
          existingWrapper.remove();
        }

        return;
      }

      let wrapper = field.parentElement;
      if (!wrapper?.classList.contains('input-counter-wrap')) {
        wrapper = document.createElement('div');
        wrapper.className = 'input-counter-wrap';
        field.insertAdjacentElement('beforebegin', wrapper);
        wrapper.appendChild(field);
      }

      let counter = wrapper.querySelector(`.input-counter[data-for="${counterKey}"]`);
      if (!counter) {
        counter = document.createElement('div');
        counter.className = 'input-counter';
        counter.dataset.for = counterKey;
        field.insertAdjacentElement('afterend', counter);
      }

      updateInputCounter(field, counter, limit);

      if (!field.dataset.counterBound) {
        field.addEventListener('input', () => updateInputCounter(field, counter, limit));
        field.dataset.counterBound = 'true';
      }
    }

    function ensureInputCounter(fieldId, limit) {
      const field = document.getElementById(fieldId);
      if (!field) return;
      ensureInputCounterForField(field, fieldId, limit);
    }

    function getDetailInlineFieldLimit(fieldName) {
      const fieldLimitKey = {
        description: 'taskDescription',
        notes: 'taskNotes'
      }[fieldName] || '';

      return INPUT_LIMITS[fieldLimitKey] || 0;
    }

    function syncInputCounterForField(field, counterKey, limit) {
      const counter = field.parentElement?.querySelector(`.input-counter[data-for="${counterKey}"]`);
      if (counter) {
        updateInputCounter(field, counter, limit);
      }
    }

    function applyDetailInlineInputLimits(root = document) {
      root.querySelectorAll('[data-task-detail-field], [data-detail-edit-input]').forEach(field => {
        const fieldName = field.dataset.taskDetailField || field.dataset.detailEditInput;
        const limit = getDetailInlineFieldLimit(fieldName);
        if (!limit) return;

        ensureInputCounterForField(field, `detail-${fieldName}`, limit);
      });
    }

    function applyInputLimits() {
      Object.entries(INPUT_LIMITS).forEach(([fieldId, limit]) => ensureInputCounter(fieldId, limit));
    }

    // ── Persistence ──
    // loadState() reads everything from the configured storage backend on startup,
    // normalises legacy values, and ensures required defaults exist.
