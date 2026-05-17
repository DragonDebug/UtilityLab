async function loadState() {
  await initializePersistence();

  tasks = await loadJson(KEYS.tasks, []);
  const storedItems = await loadJson(KEYS.items, null);
  itemSettings = normalizeItemSettings(await loadJson(KEYS.itemSettings, null));
  logs = await loadJson(KEYS.logs, []);
  categories = await loadJson(KEYS.categories, []);
  templates = await loadJson(KEYS.templates, []);
  hideDone = (await loadPreference(KEYS.hideDone, "false")) === "true";
  showSecondaryStats =
    (await loadPreference(KEYS.showSecondaryStats, "true")) !== "false";
  activeSecondaryStatsTab =
    (await loadPreference(KEYS.activeSecondaryStatsTab, "status")) || "status";
  currentTheme = await loadPreference(
    KEYS.theme,
    document.documentElement.dataset.theme || "dark",
  );
  const storedViewMode = await loadPreference(KEYS.viewMode, "standard");
  currentViewMode = normalizeTaskViewMode(storedViewMode);
  currentSortMode = normalizeTaskSortMode(
    await loadPreference(KEYS.sortMode, "workflow"),
  );

  if (storedViewMode !== currentViewMode) {
    saveViewModePreference();
  }

  if (!categories.length) {
    categories = getDefaultCategories();
  }

  categories = categories
    .map((category) => ({
      name: normalizeCategoryName(category.name),
      color: category.color || "#5b8def",
    }))
    .filter((category) => category.name);

  if (!getCategoryByName("General")) {
    categories.unshift({ name: "General", color: "#64748b" });
  }

  hiddenFilters = { status: [], priority: [], category: [] };

  const fallbackCategory = "General";
  const legacyItems = [];

  tasks = tasks.map((task) => {
    const normalizedTask = {
      ...task,
      description: String(task.description || "").trim() || null,
      emailSubject: String(task.emailSubject || "").trim() || null,
      sender: String(task.sender || "").trim() || null,
      category: getCategoryByName(task.category)?.name || fallbackCategory,
      priority: normalizePriority(task.priority),
      status: normalizeStatus(task.status),
      subtasks: normalizeTaskSubtasks(task.subtasks),
      project: String(task.project || "").trim() || null,
      progressPercent: normalizeTaskProgressPercent(task.progressPercent),
      isFavorite: normalizeTaskFavorite(task.isFavorite),
      startedAt: String(task.startedAt || "").trim() || null,
      completedAt: String(task.completedAt || "").trim() || null,
      imageDataUrl: String(task.imageDataUrl || "").trim(),
      imageName: String(task.imageName || "").trim(),
    };

    delete normalizedTask.workflowItems;
    return normalizedTask;
  });

  items = storedItems === null ? legacyItems : normalizeItems(storedItems);
}

function saveTasks() {
  saveJson(KEYS.tasks, tasks);
}

function saveItems() {
  saveJson(KEYS.items, items);
}

function saveItemSettings() {
  saveJson(KEYS.itemSettings, itemSettings);
}

function saveHiddenFilters() {
  saveJson(KEYS.hiddenFilters, hiddenFilters);
}

function saveLogs() {
  saveJson(KEYS.logs, logs);
}

function saveCategories() {
  saveJson(KEYS.categories, categories);
}

function saveTemplates() {
  saveJson(KEYS.templates, templates);
}

function saveHideDonePreference() {
  savePreference(KEYS.hideDone, hideDone);
}

function saveSecondaryStatsPreference() {
  savePreference(KEYS.showSecondaryStats, showSecondaryStats);
}

function saveActiveSecondaryStatsTabPreference() {
  savePreference(KEYS.activeSecondaryStatsTab, activeSecondaryStatsTab);
}

function saveViewModePreference() {
  savePreference(KEYS.viewMode, currentViewMode);
}

function saveSortModePreference() {
  savePreference(KEYS.sortMode, currentSortMode);
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  currentTheme = nextTheme;
  document.documentElement.classList.remove("theme-light", "theme-dark");
  document.documentElement.classList.add(`theme-${nextTheme}`);
  document.documentElement.dataset.theme = nextTheme;
  savePreference(KEYS.theme, nextTheme);
  updateThemeToggleLabel();
}

function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
}

function updateThemeToggleLabel() {
  const toggleButton = document.getElementById("themeToggleBtn");
  if (!toggleButton) return;
  const nextThemeLabel = currentTheme === "dark" ? "Light" : "Dark";
  const iconMarkup =
    currentTheme === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2"/><path d="M12 19.3v2.2"/><path d="m4.9 4.9 1.6 1.6"/><path d="m17.5 17.5 1.6 1.6"/><path d="M2.5 12h2.2"/><path d="M19.3 12h2.2"/><path d="m4.9 19.1 1.6-1.6"/><path d="m17.5 6.5 1.6-1.6"/></svg>';
  toggleButton.innerHTML = `${iconMarkup}<span class="btn-header-label">${nextThemeLabel}</span>`;
  toggleButton.title = `Switch to ${nextThemeLabel.toLowerCase()} theme`;
  toggleButton.setAttribute(
    "aria-label",
    `Switch to ${nextThemeLabel.toLowerCase()} theme`,
  );
}

function syncCategoryColorPresets(colorValue = "") {
  const normalizedColor = String(colorValue || "")
    .trim()
    .toLowerCase();
  document.querySelectorAll(".category-color-preset").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.categoryColor.toLowerCase() === normalizedColor,
    );
  });
}

function closeDetailContextMenu() {
  const menu = document.getElementById("detailContextMenu");
  if (!menu) return;
  menu.hidden = true;
}

function openDetailContextMenu(x, y) {
  const task = getTaskById(selectedTaskId);
  const menu = document.getElementById("detailContextMenu");
  if (!task || !menu) return;

  const toggleLabel = document.getElementById("detailContextToggleLabel");
  if (toggleLabel) {
    toggleLabel.textContent = isTaskCompleted(task)
      ? "Reopen task"
      : "Mark complete";
  }

  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";

  const menuRect = menu.getBoundingClientRect();
  const maxLeft = Math.max(window.innerWidth - menuRect.width - 10, 10);
  const maxTop = Math.max(window.innerHeight - menuRect.height - 10, 10);
  menu.style.left = `${Math.min(Math.max(x, 10), maxLeft)}px`;
  menu.style.top = `${Math.min(Math.max(y, 10), maxTop)}px`;
}

function updateSecondaryStatsToggle() {
  const shell = document.getElementById("taskStatsSecondaryShell");
  const toggleButton = document.getElementById("toggleTaskStatsSecondaryBtn");
  if (!shell || !toggleButton) return;

  shell.classList.toggle("is-collapsed", !showSecondaryStats);
  toggleButton.textContent = showSecondaryStats ? "Collapse" : "Expand";
  toggleButton.setAttribute("aria-expanded", String(showSecondaryStats));
}

function updateCompletedVisibilityToggleLabel() {
  const toggleButton = document.getElementById("toggleDoneBtn");
  if (!toggleButton) return;

  toggleButton.textContent = hideDone ? "Show Completed" : "Hide Completed";
  toggleButton.title = hideDone
    ? "Show completed tasks in the main list again"
    : "Hide completed tasks from the main list";
  toggleButton.setAttribute("aria-label", toggleButton.title);
}

// ── ID Generator ──
// Collision-resistant short ID built from timestamp + random suffix.
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeOptionValue(value, options, fallback, aliases = {}) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return fallback;

  const aliasMatch = Object.entries(aliases).find(
    ([key]) => key.toLowerCase() === rawValue.toLowerCase(),
  );
  const resolvedValue = aliasMatch ? aliasMatch[1] : rawValue;

  return (
    options.find(
      (option) => option.toLowerCase() === String(resolvedValue).toLowerCase(),
    ) || fallback
  );
}

function resolveExactOptionValue(value, options, aliases = {}) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  const aliasMatch = Object.entries(aliases).find(
    ([key]) => key.toLowerCase() === rawValue.toLowerCase(),
  );
  const resolvedValue = aliasMatch ? aliasMatch[1] : rawValue;

  return (
    options.find(
      (option) => option.toLowerCase() === String(resolvedValue).toLowerCase(),
    ) || ""
  );
}

function syncTaskModalFieldAccents() {
  const categoryField = document.querySelector(
    "#taskForm .task-field-category",
  );
  const priorityField = document.querySelector(
    "#taskForm .task-field-priority",
  );
  const statusField = document.querySelector("#taskForm .task-field-status");
  const categoryValue = document.getElementById("taskCategory")?.value || "";
  const priorityValue =
    document.getElementById("taskPriority")?.value || DEFAULT_PRIORITY;
  const statusValue =
    document.getElementById("taskStatus")?.value || DEFAULT_STATUS;

  if (categoryField) {
    categoryField.style.setProperty(
      "--task-group-accent",
      getCategoryColor(categoryValue) || "#64748b",
    );
  }

  if (priorityField) {
    priorityField.style.setProperty(
      "--task-group-accent",
      PRIORITY_ACCENTS[normalizePriority(priorityValue)] || "var(--medium)",
    );
  }

  if (statusField) {
    statusField.style.setProperty(
      "--task-group-accent",
      STATUS_ACCENTS[normalizeStatus(statusValue)] || "var(--status-pending)",
    );
  }
}

function getTaskModalDueSoonCount() {
  return tasks.filter((task) => {
    if (isTaskCompleted(task)) return false;
    const parts = toDateParts(task?.dueDate);
    const todayParts = toDateParts(today());
    if (!parts || !todayParts) return false;

    const dueDate = new Date(parts.year, parts.month - 1, parts.day);
    const currentDate = new Date(
      todayParts.year,
      todayParts.month - 1,
      todayParts.day,
    );
    const dayDelta = Math.round((dueDate - currentDate) / 86400000);
    return dayDelta >= 0 && dayDelta <= 7;
  }).length;
}

function buildTaskModalTimelineLabel(receivedAt, dueDate) {
  const segments = [];

  if (receivedAt) {
    segments.push(
      `Received ${receivedAt === today() ? "today" : formatDate(receivedAt) || receivedAt}`,
    );
  }

  if (dueDate) {
    segments.push(
      `Due ${dueDate === today() ? "today" : formatDate(dueDate) || dueDate}`,
    );
  }

  return segments.join(" | ") || "No dates set";
}

function normalizePriority(priority) {
  return normalizeOptionValue(priority, PRIORITY_OPTIONS, DEFAULT_PRIORITY);
}

function normalizeStatus(status) {
  return normalizeOptionValue(
    status,
    STATUS_OPTIONS,
    DEFAULT_STATUS,
    LEGACY_STATUS_ALIASES,
  );
}

function normalizeTaskSortMode(sortMode) {
  const normalizedSortMode = String(sortMode || "").trim();
  return TASK_SORT_OPTIONS.includes(normalizedSortMode)
    ? normalizedSortMode
    : "workflow";
}

function normalizeTaskViewMode(viewMode) {
  const normalizedViewMode = String(viewMode || "")
    .trim()
    .toLowerCase();
  return TASK_VIEW_OPTIONS.includes(normalizedViewMode)
    ? normalizedViewMode
    : "standard";
}

function normalizeTaskFavorite(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isTaskFavorite(task) {
  return normalizeTaskFavorite(task?.isFavorite);
}

function normalizeHiddenFilterValue(filterType, value) {
  if (filterType === "status") {
    return resolveExactOptionValue(
      value,
      STATUS_OPTIONS,
      LEGACY_STATUS_ALIASES,
    );
  }

  if (filterType === "priority") {
    return resolveExactOptionValue(value, PRIORITY_OPTIONS);
  }

  if (filterType === "category") {
    const normalizedName = normalizeCategoryName(value);
    return getCategoryByName(normalizedName)?.name || "";
  }

  return "";
}

function normalizeHiddenFilterValues(filterType, values = []) {
  const list = Array.isArray(values) ? values : [values];
  const seen = new Set();

  return list
    .map((value) => normalizeHiddenFilterValue(filterType, value))
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeHiddenFilters(filters = {}) {
  return {
    status: normalizeHiddenFilterValues("status", filters?.status),
    priority: normalizeHiddenFilterValues("priority", filters?.priority),
    category: normalizeHiddenFilterValues("category", filters?.category),
  };
}

function isFilterValueHidden(filterType, value) {
  const normalizedValue = normalizeHiddenFilterValue(filterType, value);
  return (
    Boolean(normalizedValue) &&
    (hiddenFilters?.[filterType] || []).includes(normalizedValue)
  );
}

function toggleHiddenFilter(filterType, value) {
  if (!HIDDEN_FILTER_GROUPS.includes(filterType)) return false;

  const normalizedValue = normalizeHiddenFilterValue(filterType, value);
  if (!normalizedValue) return false;

  const currentValues = new Set(hiddenFilters?.[filterType] || []);
  if (currentValues.has(normalizedValue)) {
    currentValues.delete(normalizedValue);
  } else {
    currentValues.add(normalizedValue);
  }

  hiddenFilters = {
    ...hiddenFilters,
    [filterType]: [...currentValues],
  };
  saveHiddenFilters();
  return true;
}

function clearHiddenFilters(filterType = "", value = "") {
  if (!filterType) {
    hiddenFilters = { status: [], priority: [], category: [] };
    saveHiddenFilters();
    return;
  }

  if (!HIDDEN_FILTER_GROUPS.includes(filterType)) return;

  if (!value) {
    hiddenFilters = {
      ...hiddenFilters,
      [filterType]: [],
    };
    saveHiddenFilters();
    return;
  }

  const normalizedValue = normalizeHiddenFilterValue(filterType, value);
  if (!normalizedValue) return;

  hiddenFilters = {
    ...hiddenFilters,
    [filterType]: (hiddenFilters?.[filterType] || []).filter(
      (item) => item !== normalizedValue,
    ),
  };
  saveHiddenFilters();
}

function getHiddenFilterAccent(filterType, value) {
  if (filterType === "status") {
    return STATUS_ACCENTS[normalizeStatus(value)] || "var(--accent)";
  }

  if (filterType === "priority") {
    return PRIORITY_ACCENTS[normalizePriority(value)] || "var(--accent)";
  }

  if (filterType === "category") {
    return getCategoryColor(value) || "var(--accent)";
  }

  return "var(--accent)";
}

function getHiddenFilterLabel(filterType) {
  return (
    {
      status: "Status",
      priority: "Priority",
      category: "Category",
    }[filterType] || "Filter"
  );
}

function toClassToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildOptionMarkup(options, selectedValue) {
  return options
    .map(
      (option) => `
        <option value="${escHtml(option)}"${option === selectedValue ? " selected" : ""}>${escHtml(option)}</option>`,
    )
    .join("");
}

function renderTaskOptionSets() {
  const taskPriority = document.getElementById("taskPriority");
  const taskStatus = document.getElementById("taskStatus");
  const taskSender = document.getElementById("taskSender");
  const filterPriority = document.getElementById("filterPriority");
  const filterStatus = document.getElementById("filterStatus");

  if (taskPriority) {
    const selectedPriority = normalizePriority(
      taskPriority.value || DEFAULT_PRIORITY,
    );
    taskPriority.innerHTML = buildOptionMarkup(
      PRIORITY_OPTIONS,
      selectedPriority,
    );
    taskPriority.value = selectedPriority;
  }

  if (taskStatus) {
    const selectedStatus = normalizeStatus(taskStatus.value || DEFAULT_STATUS);
    taskStatus.innerHTML = buildOptionMarkup(STATUS_OPTIONS, selectedStatus);
    taskStatus.value = selectedStatus;
  }

  if (taskSender) {
    const selectedSender = taskSender.value || "";
    taskSender.innerHTML = `<option value="">No Sender</option>${buildOptionMarkup(getSenderOptions(selectedSender), selectedSender)}`;
    taskSender.value = selectedSender;
  }

  renderTaskProjectOptions();

  if (filterPriority) {
    const selectedPriority = filterPriority.value
      ? normalizePriority(filterPriority.value)
      : "";
    filterPriority.innerHTML = `<option value="">All Priorities</option>${buildOptionMarkup(PRIORITY_OPTIONS, selectedPriority)}`;
    filterPriority.value = selectedPriority;
  }

  if (filterStatus) {
    const selectedStatus = filterStatus.value
      ? normalizeStatus(filterStatus.value)
      : "";
    filterStatus.innerHTML = `<option value="">All Statuses</option>${buildOptionMarkup(STATUS_OPTIONS, selectedStatus)}`;
    filterStatus.value = selectedStatus;
  }

  const sortTasks = document.getElementById("sortTasks");
  if (sortTasks) {
    const selectedSortMode = normalizeTaskSortMode(
      sortTasks.value || currentSortMode,
    );
    sortTasks.value = selectedSortMode;
    currentSortMode = selectedSortMode;
  }

  const taskViewSwitch = document.getElementById("taskViewSwitch");
  if (taskViewSwitch) {
    const selectedViewMode = normalizeTaskViewMode(currentViewMode);
    currentViewMode = selectedViewMode;
    taskViewSwitch.querySelectorAll("[data-view-mode]").forEach((button) => {
      const isActive = button.dataset.viewMode === selectedViewMode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  syncTaskModalFieldAccents();
}

function getDefaultCategories() {
  return [
    { name: "General", color: "#64748b" },
    { name: "Work", color: "#ef7d57" },
    { name: "Follow-up", color: "#34c38f" },
    { name: "Personal", color: "#f4b740" },
  ];
}

// ── Date Helpers ──
// formatDate() converts an ISO string (YYYY-MM-DD) to dd-MMM-yyyy.
// isOverdue() compares a due-date string against today's ISO date string.
function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateParts(value) {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return { year, month, day };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function formatDate(iso) {
  const parts = toDateParts(iso);
  if (!parts) return null;

  const day = String(parts.day).padStart(2, "0");
  const month = MONTH_LABELS[parts.month - 1];
  return `${day}-${month}-${parts.year}`;
}

function isOverdue(iso) {
  return iso && iso < today();
}

function formatDateTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const formattedDate = formatDate(date.toISOString().slice(0, 10));
  const formattedTime = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formattedDate} ${formattedTime}`;
}

function getTaskCompletedDayNumber(task) {
  if (!isTaskCompleted(task)) return null;
  return toDayNumber(task?.completedAt);
}

function isCompletedTaskOlderThanDays(task, days, referenceValue = today()) {
  if (!isTaskCompleted(task)) return false;

  const completedDayNumber = getTaskCompletedDayNumber(task);
  const referenceDayNumber = toDayNumber(referenceValue);
  if (completedDayNumber === null || referenceDayNumber === null) return false;

  return referenceDayNumber - completedDayNumber > days;
}

function isCompletedTaskBeforeYear(task, year) {
  if (!isTaskCompleted(task)) return false;

  const completedParts = toDateParts(task?.completedAt);
  if (!completedParts) return false;

  return completedParts.year < year;
}

function shouldAutoHideCompletedTask(task) {
  if (!isTaskCompleted(task)) return false;
  if (getCompletedTaskVisibilityMode() !== "hide-older") return false;

  return isCompletedTaskOlderThanDays(task, getCompletedTaskVisibleDays());
}

function formatLogDateTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const weekday = date.toLocaleDateString([], { weekday: "short" });
  const formattedDate = formatDate(date.toISOString().slice(0, 10));
  const formattedTime = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${weekday} ${formattedDate}, ${formattedTime}`;
}

function formatDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "";

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function getTaskById(taskId) {
  return tasks.find((task) => task.id === taskId) || null;
}

function getLogById(logId) {
  return logs.find((log) => log.id === logId) || null;
}

function isTaskCompleted(task) {
  return normalizeStatus(task?.status) === "Completed";
}

function toIsoDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(value = new Date()) {
  const date =
    value instanceof Date
      ? new Date(value.getFullYear(), value.getMonth(), 1)
      : toDateOnly(value);
  if (!date) return null;
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfMonth(value = new Date()) {
  const start = startOfMonth(value);
  if (!start) return null;
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function startOfQuarter(value = new Date()) {
  const date =
    value instanceof Date
      ? new Date(value.getFullYear(), value.getMonth(), 1)
      : toDateOnly(value);
  if (!date) return null;
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function endOfQuarter(value = new Date()) {
  const start = startOfQuarter(value);
  if (!start) return null;
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

function startOfYear(value = new Date()) {
  const date = value instanceof Date ? value : toDateOnly(value);
  if (!date) return null;
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(value = new Date()) {
  const start = startOfYear(value);
  if (!start) return null;
  return new Date(start.getFullYear(), 11, 31);
}

function formatMonthYearLabel(value) {
  const date = value instanceof Date ? value : toDateOnly(value);
  if (!date) return "";
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatQuarterLabel(value) {
  const date = value instanceof Date ? value : toDateOnly(value);
  if (!date) return "";
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
}

function formatShortDateLabel(value) {
  const date = value instanceof Date ? value : toDateOnly(value);
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")} ${MONTH_LABELS[date.getMonth()]}`;
}

function formatReportRange(start, end) {
  const safeStart = start instanceof Date ? start : toDateOnly(start);
  const safeEnd = end instanceof Date ? end : toDateOnly(end);
  if (!safeStart || !safeEnd) return "Live task snapshot";
  return `${formatShortDateLabel(safeStart)} - ${formatShortDateLabel(safeEnd)} ${safeEnd.getFullYear()}`;
}

function shiftDateByDays(value, days) {
  const date = value instanceof Date ? new Date(value) : toDateOnly(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return date;
}

function shiftDateByMonths(value, months) {
  const date =
    value instanceof Date
      ? new Date(value.getFullYear(), value.getMonth(), 1)
      : startOfMonth(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function shiftDateByYears(value, years) {
  const date =
    value instanceof Date
      ? new Date(value.getFullYear(), 0, 1)
      : startOfYear(value);
  if (!date) return null;
  return new Date(date.getFullYear() + years, date.getMonth(), 1);
}

function isDateWithinRange(value, start, end) {
  const date = toDateOnly(value);
  const safeStart = start instanceof Date ? start : toDateOnly(start);
  const safeEnd = end instanceof Date ? end : toDateOnly(end);
  return (
    Boolean(date && safeStart && safeEnd) &&
    date >= safeStart &&
    date <= safeEnd
  );
}

function getTaskAgeInDays(task, now = new Date()) {
  const reference = task?.receivedAt || task?.createdAt;
  const start = toDateOnly(reference);
  if (!start) return null;
  const endDate = isTaskCompleted(task)
    ? toDateOnly(task.completedAt) || now
    : now;
  const normalizedEnd = endDate instanceof Date ? endDate : toDateOnly(endDate);
  if (!normalizedEnd) return null;
  return Math.max(0, Math.floor((normalizedEnd - start) / MS_PER_DAY));
}

function applyTaskStatusChange(task, nextStatus, options = {}) {
  if (!task) return false;

  const normalizedStatus = normalizeStatus(nextStatus);
  const previousStatus = normalizeStatus(options.previousStatus ?? task.status);
  task.status = normalizedStatus;

  if (normalizedStatus === "Ongoing" && previousStatus !== "Ongoing") {
    task.startedAt = today();
  }

  if (normalizedStatus === "Completed" && previousStatus !== "Completed") {
    task.completedAt = today();
    task.progressPercent = 100;
  } else if (normalizedStatus !== "Completed") {
    task.completedAt = null;
  }

  return true;
}

function syncTaskLifecycleDraftDates() {
  const startedField = document.getElementById("taskStartedAt");
  const completedField = document.getElementById("taskCompletedAt");
  const statusField = document.getElementById("taskStatus");
  if (!startedField || !completedField || !statusField) return;

  const currentTask = editingId ? getTaskById(editingId) : null;
  const normalizedStatus = normalizeStatus(
    statusField.value || currentTask?.status || DEFAULT_STATUS,
  );
  const previousStatus = normalizeStatus(
    statusField.dataset.lifecycleStatus ||
      currentTask?.status ||
      DEFAULT_STATUS,
  );
  let startedAt = startedField.value || currentTask?.startedAt || "";
  let completedAt = completedField.value || currentTask?.completedAt || "";

  if (normalizedStatus === "Ongoing" && previousStatus !== "Ongoing") {
    startedAt = today();
  }

  if (normalizedStatus === "Completed" && previousStatus !== "Completed") {
    completedAt = today();
  } else if (normalizedStatus !== "Completed") {
    completedAt = "";
  }

  startedField.value = startedAt;
  completedField.value = completedAt;
  statusField.dataset.lifecycleStatus = normalizedStatus;
}

function getCategoryByName(categoryName) {
  return categories.find((category) => category.name === categoryName) || null;
}

function isProtectedCategory(categoryName) {
  return categoryName === "General";
}

function normalizeCategoryName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearActiveSubtaskEdit() {
  activeSubtaskEditTaskId = null;
  activeSubtaskEditId = null;
}

function getHighlightedMarkup(text, query) {
  const source = String(text || "");
  const searchQuery = String(query || "").trim();
  if (!source) return "";
  if (!searchQuery) return escHtml(source);

  const pattern = new RegExp(escapeRegExp(searchQuery), "ig");
  let markup = "";
  let lastIndex = 0;

  source.replace(pattern, (match, offset) => {
    markup += escHtml(source.slice(lastIndex, offset));
    markup += `<mark class="search-highlight">${escHtml(match)}</mark>`;
    lastIndex = offset + match.length;
    return match;
  });

  markup += escHtml(source.slice(lastIndex));
  return markup;
}

function getFilterBadgeMarkup(filterType, value, options = {}) {
  const normalizedValue = normalizeHiddenFilterValue(filterType, value);
  if (!normalizedValue) return "";

  const classes = ["badge", "filter-badge-btn"];
  let styleAttribute = "";
  if (filterType === "category") {
    classes.push("badge-category");
    styleAttribute = ` style="--category-color:${escHtml(options.accent || getCategoryColor(normalizedValue) || "transparent")}"`;
  } else {
    classes.push(`badge-${toClassToken(normalizedValue)}`);
  }

  if (isFilterValueHidden(filterType, normalizedValue)) {
    classes.push("is-excluded");
  }

  return `<span class="${classes.join(" ")}"${styleAttribute}>${escHtml(normalizedValue)}</span>`;
}

function getCategoryMarkup(categoryName) {
  const category = getCategoryByName(categoryName) || categories[0];
  if (!category) return "";
  return getFilterBadgeMarkup("category", category.name, {
    accent: category.color,
  });
}

function getTaskTypeMarkup(categoryName) {
  const category = getCategoryByName(categoryName) || categories[0];
  if (!category) return "";

  return `
        <div class="task-type-line" style="--task-type-color:${escHtml(category.color || "var(--accent)")}">
          <span class="task-type-dot" aria-hidden="true"></span>
          <span class="task-type-name">${escHtml(category.name)}</span>
        </div>`;
}

function getTaskProjectMarkup(projectName, searchQuery = "") {
  const normalizedProject = String(projectName || "").trim();
  if (!normalizedProject) return "";

  return `<div class="task-project-pill" title="${escHtml(normalizedProject)}"><span>${getHighlightedMarkup(normalizedProject, searchQuery)}</span></div>`;
}

function getTaskImageAlt(task) {
  if (!task) return "Task image";

  return task.imageName
    ? `${task.title} image (${task.imageName})`
    : `${task.title} image`;
}

function getTaskMediaMarkup(task) {
  if (!task?.imageDataUrl) return "";

  return `
        <div class="task-card-media">
          <img src="${escHtml(task.imageDataUrl)}" alt="${escHtml(getTaskImageAlt(task))}" loading="lazy" />
        </div>`;
}

function getTaskDetailMediaMarkup(task) {
  if (!task?.imageDataUrl) return "";

  const imageName = String(task.imageName || "").trim();

  return `
        <div class="detail-media-card" aria-label="Task reference image">
          <div class="detail-media-header">
            <div class="section-title">Reference Image</div>
            <span class="detail-media-name" title="${escHtml(imageName || "Attached image")}">${escHtml(imageName || "Attached image")}</span>
          </div>
          <div class="detail-media-frame">
            <img src="${escHtml(task.imageDataUrl)}" alt="${escHtml(getTaskImageAlt(task))}" loading="lazy" />
          </div>
        </div>`;
}

function getTaskPriorityMarkup(priority) {
  const normalizedPriority = normalizePriority(priority);
  const accent = PRIORITY_ACCENTS[normalizedPriority] || "var(--accent)";
  const priorityFill =
    {
      Critical: "100%",
      High: "82%",
      Medium: "62%",
      Low: "42%",
      "Very Low": "28%",
    }[normalizedPriority] || "58%";

  return `
        <div class="task-priority" style="--priority-color:${escHtml(accent)};--priority-fill:${escHtml(priorityFill)}">
          <div class="task-priority-bar" aria-hidden="true"></div>
          <div class="task-priority-label"><span class="task-priority-dot" aria-hidden="true"></span>${escHtml(normalizedPriority)} Priority</div>
        </div>`;
}

function getTaskActionToolsMarkup(taskId) {
  return `
        <div class="task-action-tools">
          <button class="task-action-icon-btn is-edit" type="button" data-edit="${taskId}" title="Edit task" aria-label="Edit task">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
            </svg>
          </button>
          <button class="task-action-icon-btn is-delete" type="button" data-delete="${taskId}" title="Delete task" aria-label="Delete task">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>`;
}

function getCategoryColor(categoryName) {
  return getCategoryByName(categoryName)?.color || "transparent";
}

function getTemplateById(templateId) {
  return templates.find((template) => template.id === templateId) || null;
}

function parseSubtaskLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeTaskSubtasks(subtasks) {
  return (Array.isArray(subtasks) ? subtasks : [])
    .map((subtask) => {
      if (typeof subtask === "string") {
        const title = normalizeSingleLineText(subtask);
        return title ? { id: genId(), title, done: false } : null;
      }

      const title = normalizeSingleLineText(subtask?.title);
      if (!title) return null;

      return {
        id: String(subtask.id || genId()),
        title,
        done: Boolean(subtask.done),
      };
    })
    .filter(Boolean);
}

function normalizeSingleLineText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getTaskCategoryCountWeight(task) {
  const title = String(task?.title || "");
  const match = title.match(/\b(\d+)\s*nos\b/i);
  if (!match) return 1;

  const quantity = Number.parseInt(match[1], 10);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function parseTaskTitleLines(text) {
  return parseSubtaskLines(text)
    .map((line) => normalizeSingleLineText(line))
    .filter(Boolean);
}

function buildTaskSubtasks(templateId) {
  const template = getTemplateById(templateId);
  if (!template) return [];
  return template.subtasks.map((title) => ({
    id: genId(),
    title,
    done: false,
  }));
}

function normalizeUniqueReference(value) {
  return String(value || "").trim();
}

function normalizeLegacyTaskItems(legacyItems, taskId, taskTitle) {
  return [];
}

function normalizeItemStatus(value) {
  const normalizedValue = String(value || "").trim();
  return ITEM_STATUS_OPTIONS.includes(normalizedValue)
    ? normalizedValue
    : DEFAULT_ITEM_STATUS;
}

function getItemStatusMeta(status) {
  const normalizedStatus = normalizeItemStatus(status);
  return normalizedStatus === "235"
    ? {
        value: normalizedStatus,
        label: "Status 235",
        accent: "#34c38f",
      }
    : {
        value: normalizedStatus,
        label: "Status 110",
        accent: "#ef7d57",
      };
}

function normalizeItems(itemList) {
  if (!Array.isArray(itemList)) return [];

  return itemList
    .map((item) => {
      const bid = normalizeUniqueReference(item?.bid ?? item?.BID ?? "");
      const tid = normalizeUniqueReference(item?.tid ?? item?.TID ?? "");
      if (!bid && !tid) return null;

      return {
        id: item?.id || genId(),
        taskId: item?.taskId || null,
        taskTitleSnapshot: String(item?.taskTitleSnapshot || "").trim(),
        tid,
        bid,
        status: normalizeItemStatus(item?.status ?? item?.Status),
        supplier: normalizeUniqueReference(item?.supplier ?? item?.Supplier),
        imageDataUrl: String(item?.imageDataUrl || "").trim(),
        imageName: String(item?.imageName || "").trim(),
        createdAt: item?.createdAt || new Date().toISOString(),
      };
    })
    .filter((item) => item && (item.bid || item.tid));
}

function buildSelectOptions(
  options,
  selectedValue,
  placeholderLabel = "Select",
) {
  return `<option value="">${escHtml(placeholderLabel)}</option>${options
    .map(
      (option) => `
        <option value="${escHtml(option)}"${String(selectedValue || "") === option ? " selected" : ""}>${escHtml(option)}</option>`,
    )
    .join("")}`;
}

function getItemById(itemId) {
  return items.find((item) => item.id === itemId) || null;
}

function getItemsForTask(taskId) {
  return items.filter((item) => item.taskId === taskId);
}

function getItemTaskLabel(item) {
  return (
    getTaskById(item?.taskId)?.title ||
    (item?.taskTitleSnapshot
      ? `Unassigned (was ${item.taskTitleSnapshot})`
      : "Unassigned")
  );
}

function getItemPrimaryReference(item) {
  return item?.bid || item?.tid || "Item";
}

function getItemReferenceSummary(item) {
  if (item?.bid && item?.tid) {
    return `${item.bid} / TID ${item.tid}`;
  }

  return getItemPrimaryReference(item);
}
function createTaskItem(values = {}, task = null) {
  return (
    normalizeItems([
      {
        id: genId(),
        taskId: task?.id || null,
        taskTitleSnapshot: String(task?.title || "").trim(),
        tid: normalizeUniqueReference(values.tid),
        bid: normalizeUniqueReference(values.bid),
        status: normalizeItemStatus(values.status),
        supplier: normalizeUniqueReference(values.supplier),
        imageDataUrl: String(values.imageDataUrl || "").trim(),
        imageName: String(values.imageName || "").trim(),
        createdAt: new Date().toISOString(),
      },
    ])[0] || null
  );
}

function getDuplicateItemMessages(candidate, excludeId = null) {
  return [];
}

function getBatchDuplicateMessages(batchItems) {
  return [];
}

function getItemSearchText(item) {
  return [
    item.bid,
    item.tid,
    item.status,
    item.supplier,
    getItemTaskLabel(item),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getItemEditorMarkup(item, options = {}) {
  const showTaskLink = options.showTaskLink === true;
  const statusMeta = getItemStatusMeta(item.status);
  const supplierValue = String(item.supplier || "").trim();

  return `
        <article class="workflow-item status-${toClassToken(statusMeta.value)}" style="--item-status-accent:${statusMeta.accent}">
          <div class="workflow-item-media">
            <div class="workflow-item-media-inline">
              ${item.imageDataUrl ? `<button type="button" class="workflow-item-image-clear" data-clear-item-image="${item.id}" aria-label="Remove image">x</button>` : ""}
              <label class="workflow-item-image-frame workflow-item-upload${item.imageDataUrl ? "" : " is-empty"}">
                ${
                  item.imageDataUrl
                    ? `<img class="workflow-item-image-preview" src="${escHtml(item.imageDataUrl)}" alt="${escHtml(getItemReferenceSummary(item))}" />`
                    : '<span class="workflow-item-image-placeholder"><strong>+</strong><span>Add image</span></span>'
                }
                <input type="file" accept="image/*" data-item-image-upload="${item.id}" />
              </label>
            </div>
          </div>
          <div class="workflow-item-body">
            <div class="workflow-item-top">
              <div class="workflow-item-header-main">
                <div class="workflow-item-heading">
                  <strong class="workflow-item-number">${escHtml(item.bid || item.tid || "Item")}</strong>
                </div>
                ${showTaskLink ? `<div class="workflow-item-task-link">Task: ${escHtml(getItemTaskLabel(item))}</div>` : ""}
              </div>
              <div class="workflow-item-actions">
                <button type="button" class="workflow-item-delete-btn" data-delete-item="${item.id}" aria-label="Delete item" title="Delete item">&times;</button>
              </div>
            </div>
            <div class="workflow-item-grid">
              <div class="workflow-item-field-group">
                <label>BID</label>
                <input type="text" value="${escHtml(item.bid)}" data-item-id="${item.id}" data-item-field="bid" placeholder="BID" />
              </div>
              <div class="workflow-item-field-group">
                <label>TID</label>
                <input type="text" value="${escHtml(item.tid)}" data-item-id="${item.id}" data-item-field="tid" placeholder="TID" />
              </div>
              <div class="workflow-item-field-group">
                <label>Status</label>
                <select class="workflow-item-status-select" data-item-id="${item.id}" data-item-field="status">${buildSelectOptions(ITEM_STATUS_OPTIONS, item.status || DEFAULT_ITEM_STATUS, "Select status")}</select>
              </div>
              <div class="workflow-item-field-group">
                <label>Supplier</label>
                <select data-item-id="${item.id}" data-item-field="supplier">${buildSelectOptions(getSupplierOptions(supplierValue), supplierValue, "No supplier")}</select>
              </div>
            </div>
          </div>
        </article>`;
}

function getAllItemsTableRowMarkup(item) {
  const statusMeta = getItemStatusMeta(item.status);
  const supplierValue = String(item.supplier || "").trim();
  const taskLabel = getItemTaskLabel(item);
  const imageLabel = item.imageName || getItemReferenceSummary(item);

  return `
        <tr class="items-table-row status-${toClassToken(statusMeta.value)}" style="--item-status-accent:${statusMeta.accent}">
          <td class="items-table-cell">
            <div class="items-table-cell-inner is-image">
              <label class="workflow-item-image-frame workflow-item-upload items-table-image-frame${item.imageDataUrl ? "" : " is-empty"}" title="${escHtml(imageLabel)}">
                ${
                  item.imageDataUrl
                    ? `<img class="workflow-item-image-preview" src="${escHtml(item.imageDataUrl)}" alt="${escHtml(getItemReferenceSummary(item))}" />`
                    : '<span class="workflow-item-image-placeholder"><strong>+</strong><span>Add image</span></span>'
                }
                <input type="file" accept="image/*" data-item-image-upload="${item.id}" />
              </label>
              ${
                item.imageDataUrl
                  ? `<button type="button" class="items-table-image-action" data-clear-item-image="${item.id}">Remove image</button>`
                  : '<span class="items-table-image-hint">Attach image</span>'
              }
            </div>
          </td>
          <td class="items-table-cell">
            <div class="items-table-cell-inner">
              <input class="items-table-input" type="text" value="${escHtml(item.bid)}" data-item-id="${item.id}" data-item-field="bid" placeholder="BID" />
            </div>
          </td>
          <td class="items-table-cell">
            <div class="items-table-cell-inner">
              <input class="items-table-input" type="text" value="${escHtml(item.tid)}" data-item-id="${item.id}" data-item-field="tid" placeholder="TID" />
            </div>
          </td>
          <td class="items-table-cell">
            <div class="items-table-cell-inner is-task">
              <div class="items-table-task-text${taskLabel === "Unassigned" ? " is-muted" : ""}" title="${escHtml(taskLabel)}">${escHtml(taskLabel)}</div>
            </div>
          </td>
          <td class="items-table-cell">
            <div class="items-table-cell-inner">
              <div class="items-table-status-wrap">
                <span class="items-table-status-pill">${escHtml(statusMeta.label)}</span>
                <select class="items-table-input items-table-select workflow-item-status-select" data-item-id="${item.id}" data-item-field="status">${buildSelectOptions(ITEM_STATUS_OPTIONS, item.status || DEFAULT_ITEM_STATUS, "Select status")}</select>
              </div>
            </div>
          </td>
          <td class="items-table-cell">
            <div class="items-table-cell-inner">
              <select class="items-table-input items-table-select" data-item-id="${item.id}" data-item-field="supplier">${buildSelectOptions(getSupplierOptions(supplierValue), supplierValue, "No supplier")}</select>
            </div>
          </td>
          <td class="items-table-cell">
            <div class="items-table-cell-inner is-actions">
              <div class="items-table-actions">
                <button type="button" class="items-table-delete-btn" data-delete-item="${item.id}">Delete item</button>
              </div>
            </div>
          </td>
        </tr>`;
}

function getAllItemsTableMarkup(itemsToRender) {
  const columns = [
    { label: "Image", width: "132px" },
    { label: "BID", width: "170px" },
    { label: "TID", width: "170px" },
    { label: "Task", width: "260px", headerClass: "is-task" },
    { label: "Status", width: "150px" },
    { label: "Supplier", width: "220px" },
    { label: "Actions", width: "150px" },
  ];

  return `
        <div class="items-table-shell">
          <table class="items-data-table" aria-label="All items table">
            <colgroup>
              ${columns.map((column) => `<col style="width:${escHtml(column.width)}">`).join("")}
            </colgroup>
            <thead>
              <tr>
                ${columns.map((column) => `<th scope="col" class="items-table-head${column.headerClass ? ` ${column.headerClass}` : ""}"><span class="items-table-head-label">${escHtml(column.label)}</span></th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${itemsToRender.map((item) => getAllItemsTableRowMarkup(item)).join("")}
            </tbody>
          </table>
        </div>`;
}

function getWorkflowItemsSectionMarkup(task) {
  const taskItems = getItemsForTask(task.id);

  return `
        <div class="detail-section-header">
          <div class="section-title">Items</div>
          <span class="detail-section-meta">${taskItems.length} linked</span>
        </div>
        <form class="workflow-item-form" id="workflowItemForm">
          <div class="workflow-item-defaults">
            <div class="workflow-item-field-group">
              <label for="workflowItemBidInput">BID</label>
              <input type="text" id="workflowItemBidInput" class="workflow-item-default-input" placeholder="BID" />
            </div>
            <div class="workflow-item-field-group">
              <label for="workflowItemTidInput">TID</label>
              <input type="text" id="workflowItemTidInput" class="workflow-item-default-input" placeholder="TID" />
            </div>
            <div class="workflow-item-field-group">
              <label for="workflowItemStatusInput">Status</label>
              <select id="workflowItemStatusInput" class="workflow-item-default-input is-select">${buildSelectOptions(ITEM_STATUS_OPTIONS, DEFAULT_ITEM_STATUS, "Select status")}</select>
            </div>
            <div class="workflow-item-field-group">
              <label for="workflowItemSupplierInput">Supplier</label>
              <select id="workflowItemSupplierInput" class="workflow-item-default-input is-select">${buildSelectOptions(getSupplierOptions(), "", "No supplier")}</select>
            </div>
            <div class="workflow-item-field-group">
              <label for="workflowItemImageInput">Image</label>
              <input type="file" id="workflowItemImageInput" class="workflow-item-default-input" accept="image/*" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary workflow-item-submit-btn">Add Item</button>
            <button type="button" class="btn btn-ghost" data-open-item-import>Import Excel</button>
            <input type="file" id="workflowItemImportInput" accept=".xlsx,.xls" hidden />
          </div>
        </form>
        ${
          taskItems.length
            ? `<div class="workflow-item-list-shell"><div class="workflow-item-list">${taskItems.map((item) => getItemEditorMarkup(item)).join("")}</div></div>`
            : '<div class="workflow-item-empty">No items linked to this task yet. Add one above or import an Excel sheet into this task.</div>'
        }`;
}

function getLogsByTaskId(taskId) {
  return logs
    .filter((log) => log.taskId === taskId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function getLogEntryMarkup(log) {
  const isEditing = activeLogDateEditId === log.id;

  return `
        <article class="log-entry ${isEditing ? "is-editing" : ""}">
          <div class="log-entry-main">
            ${
              isEditing
                ? `
              <form class="log-entry-date-form" data-log-date-form="${log.id}">
                <div class="log-entry-edit-top">
                  <input type="datetime-local" class="log-entry-time-edit" data-log-date-input="${log.id}" value="${escHtml(formatDateTimeLocalValue(log.createdAt))}" required />
                  <div class="log-entry-date-actions">
                    <button type="submit" class="btn btn-primary log-entry-action-btn">Save</button>
                    <button type="button" class="btn btn-ghost log-entry-action-btn" data-cancel-log-date-edit="${log.id}">Cancel</button>
                  </div>
                </div>
                <textarea class="log-entry-text-edit" data-log-content-input="${log.id}" maxlength="${INPUT_LIMITS.logContent}" required>${escHtml(log.content || "")}</textarea>
              </form>`
                : `
              <div class="log-entry-header">
                <span class="log-entry-time">${escHtml(formatLogDateTime(log.createdAt) || "")}</span>
                <div class="log-entry-controls">
                  <button class="btn btn-ghost log-entry-action-btn" type="button" data-edit-log-date="${log.id}">Edit</button>
                  <button class="btn btn-danger" type="button" data-delete-log="${log.id}" aria-label="Delete log" title="Delete log">&times;</button>
                </div>
              </div>
              <div class="log-entry-body">${escHtml(log.content)}</div>`
            }
          </div>
        </article>`;
}

function deleteItemsByTaskIds(taskIds) {
  const taskIdSet = taskIds instanceof Set ? taskIds : new Set(taskIds || []);
  if (!taskIdSet.size) return;

  const nextItems = items.filter((item) => !taskIdSet.has(item.taskId));
  const remainingItemIds = new Set(nextItems.map((item) => item.id));
  selectedItemIds = new Set(
    [...selectedItemIds].filter((itemId) => remainingItemIds.has(itemId)),
  );
  items = nextItems;
}

function deleteTasksAndLinkedData(taskIds) {
  const taskIdSet = taskIds instanceof Set ? taskIds : new Set(taskIds || []);
  if (!taskIdSet.size) return false;

  tasks = tasks.filter((task) => !taskIdSet.has(task.id));
  logs = logs.filter((log) => !taskIdSet.has(log.taskId));
  deleteItemsByTaskIds(taskIdSet);

  if (selectedTaskId && taskIdSet.has(selectedTaskId)) {
    selectedTaskId = null;
  }

  return true;
}

function getCompletedTasksForCleanup(criteria = {}) {
  const mode = String(criteria?.mode || "all")
    .trim()
    .toLowerCase();

  switch (mode) {
    case "older-than-days": {
      const days = normalizePositiveInteger(criteria?.days, null, 1, 3650);
      if (!Number.isInteger(days)) return [];
      return tasks.filter((task) => isCompletedTaskOlderThanDays(task, days));
    }
    case "before-year": {
      const year = normalizePositiveInteger(criteria?.year, null, 2000, 9999);
      if (!Number.isInteger(year)) return [];
      return tasks.filter((task) => isCompletedTaskBeforeYear(task, year));
    }
    default:
      return tasks.filter((task) => isTaskCompleted(task));
  }
}

function clearCompletedTasks(criteria = {}) {
  const completedTaskIds = getCompletedTasksForCleanup(criteria).map(
    (task) => task.id,
  );

  if (!completedTaskIds.length) {
    return 0;
  }

  const completedTaskIdSet = new Set(completedTaskIds);
  deleteTasksAndLinkedData(completedTaskIdSet);

  saveTasks();
  saveLogs();
  saveItems();
  renderTasks();
  return completedTaskIds.length;
}

function getScrollTop(element) {
  return element ? element.scrollTop : 0;
}

function restoreScrollTop(element, scrollTop) {
  if (!element || !Number.isFinite(scrollTop)) return;
  element.scrollTop = Math.max(0, scrollTop);
}

function captureChildScrollPositions(root, selectors = []) {
  if (!root) return {};

  return selectors.reduce((positions, selector) => {
    const element = root.querySelector(selector);
    if (element) {
      positions[selector] = element.scrollTop;
    }
    return positions;
  }, {});
}

function restoreChildScrollPositions(root, positions = {}) {
  if (!root) return;

  Object.entries(positions).forEach(([selector, scrollTop]) => {
    const element = root.querySelector(selector);
    restoreScrollTop(element, scrollTop);
  });
}

// ── Render Stats ──
// Rebuilds both the primary stat chips and the secondary micro-stat grid.
// Called as part of renderTasks() so counts always stay in sync.
