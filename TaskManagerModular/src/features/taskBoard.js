function getCurrentFilters() {
  return {
    search: normalizeSearchText(
      document.getElementById("searchTasks")?.value || "",
    ),
    category: document.getElementById("filterCategory")?.value || "",
    priority: document.getElementById("filterPriority")?.value || "",
    status: document.getElementById("filterStatus")?.value || "",
    sort: normalizeTaskSortMode(
      document.getElementById("sortTasks")?.value || currentSortMode,
    ),
  };
}

function getTaskSearchText(task) {
  const subtaskText = (task.subtasks || [])
    .map((subtask) => subtask?.title)
    .filter(Boolean)
    .join(" ");
  const taskItems = getItemsForTask(task.id);
  const workflowText = taskItems
    .map((item) =>
      [item.bid, item.tid, item.status, item.supplier]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");

  return normalizeSearchText(
    [
      task.title,
      task.sender,
      task.description,
      task.emailSubject,
      task.notes,
      task.project,
      task.category,
      task.priority,
      task.status,
      getTemplateById(task.templateId)?.name || "",
      subtaskText,
      workflowText,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function renderTaskProjectOptions() {
  const projectField = document.getElementById("taskProject");
  const projectOptions = document.getElementById("taskProjectOptions");
  if (!projectField || !projectOptions) return;

  const currentValue = projectField.value || "";
  projectOptions.innerHTML = getProjectOptions(currentValue)
    .map(
      (option) => `
        <option value="${escHtml(option)}"></option>`,
    )
    .join("");
}

function updateTaskImagePreview() {
  const preview = document.getElementById("taskImagePreview");
  const placeholder = document.getElementById("taskImagePlaceholder");
  const upload = document.getElementById("taskImageUpload");
  const clearButton = document.getElementById("clearTaskImageBtn");
  if (!preview || !placeholder || !upload || !clearButton) return;

  const hasImage = Boolean(taskDraftImageDataUrl);
  preview.hidden = !hasImage;
  placeholder.hidden = hasImage;
  clearButton.hidden = !hasImage;
  upload.classList.toggle("is-empty", !hasImage);

  if (hasImage) {
    preview.src = taskDraftImageDataUrl;
    upload.setAttribute("aria-label", taskDraftImageName || "Selected image");
  } else {
    preview.removeAttribute("src");
    upload.setAttribute("aria-label", "Add a reference image");
  }
}

function clearTaskDraftImage() {
  taskDraftImageDataUrl = "";
  taskDraftImageName = "";
  const input = document.getElementById("taskImageInput");
  if (input) input.value = "";
  updateTaskImagePreview();
}

function getSubtaskProgress(task) {
  const subtaskCount = task.subtasks?.length || 0;
  const completedCount = (task.subtasks || []).filter(
    (subtask) => subtask.done,
  ).length;
  return { completedCount, subtaskCount };
}

function getSubtaskCompletionPercent(task) {
  const { completedCount, subtaskCount } = getSubtaskProgress(task);
  if (!subtaskCount) return 0;
  return Math.round((completedCount / subtaskCount) * 100);
}

function updateSubtaskTitle(task, subtaskId, title) {
  if (!task) return false;

  const nextTitle = normalizeSingleLineText(title);
  if (!nextTitle) return false;

  let didUpdate = false;
  task.subtasks = (task.subtasks || []).map((subtask) => {
    if (subtask.id !== subtaskId) return subtask;
    didUpdate = true;
    return { ...subtask, title: nextTitle };
  });

  return didUpdate;
}

function setAllSubtasksDone(task, done) {
  if (!task?.subtasks?.length) return false;

  let didUpdate = false;
  task.subtasks = (task.subtasks || []).map((subtask) => {
    if (subtask.done === done) return subtask;
    didUpdate = true;
    return { ...subtask, done };
  });

  return didUpdate;
}

function clearCompletedSubtasks(task) {
  if (!task?.subtasks?.length) return false;

  const nextSubtasks = (task.subtasks || []).filter((subtask) => !subtask.done);
  if (nextSubtasks.length === (task.subtasks || []).length) return false;

  task.subtasks = nextSubtasks;
  return true;
}

function moveSubtask(task, subtaskId, direction) {
  if (!task) return false;

  const subtasks = [...(task.subtasks || [])];
  const currentIndex = subtasks.findIndex(
    (subtask) => subtask.id === subtaskId,
  );
  if (currentIndex === -1) return false;

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= subtasks.length) return false;

  [subtasks[currentIndex], subtasks[nextIndex]] = [
    subtasks[nextIndex],
    subtasks[currentIndex],
  ];
  task.subtasks = subtasks;
  return true;
}

function getSubtaskPreview(task) {
  const pendingSubtasks = (task.subtasks || [])
    .filter((subtask) => !subtask.done)
    .slice(0, 2);
  if (!pendingSubtasks.length) return "No open subtasks";
  return pendingSubtasks.map((subtask) => subtask.title).join(" • ");
}

function getLogPreview(taskId) {
  const taskLogs = getLogsByTaskId(taskId);
  if (!taskLogs.length) return { count: 0, preview: "No logs yet" };
  return {
    count: taskLogs.length,
    preview: taskLogs[0].content,
  };
}

function compareTasks(a, b, sortMode) {
  if (sortMode === "due-date") {
    const dueA = a.dueDate || "9999-12-31";
    const dueB = b.dueDate || "9999-12-31";
    return dueA.localeCompare(dueB) || a.title.localeCompare(b.title);
  }

  if (sortMode === "received-date") {
    const receivedA = a.receivedAt || "9999-12-31";
    const receivedB = b.receivedAt || "9999-12-31";
    return receivedA.localeCompare(receivedB) || a.title.localeCompare(b.title);
  }

  if (sortMode === "created-date") {
    return (
      (b.createdAt || "").localeCompare(a.createdAt || "") ||
      a.title.localeCompare(b.title)
    );
  }

  if (sortMode === "priority") {
    return (
      (PRIORITY_ORDER[normalizePriority(a.priority)] ??
        PRIORITY_OPTIONS.length) -
        (PRIORITY_ORDER[normalizePriority(b.priority)] ??
          PRIORITY_OPTIONS.length) || a.title.localeCompare(b.title)
    );
  }

  if (sortMode === "title") {
    return a.title.localeCompare(b.title);
  }

  const statusOrder =
    (STATUS_ORDER[normalizeStatus(a.status)] ?? STATUS_OPTIONS.length) -
    (STATUS_ORDER[normalizeStatus(b.status)] ?? STATUS_OPTIONS.length);
  if (statusOrder !== 0) return statusOrder;

  const priorityOrder =
    (PRIORITY_ORDER[normalizePriority(a.priority)] ?? PRIORITY_OPTIONS.length) -
    (PRIORITY_ORDER[normalizePriority(b.priority)] ?? PRIORITY_OPTIONS.length);
  if (priorityOrder !== 0) return priorityOrder;

  return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
}

function getTaskTableColumn(columnKey) {
  return TASK_TABLE_COLUMNS.find((column) => column.key === columnKey) || null;
}

function getDefaultTaskTableSortDirection(columnKey) {
  return ["quantity", "receivedAt", "startedAt", "completedAt"].includes(
    columnKey,
  )
    ? "desc"
    : "asc";
}

function toggleTaskTableSort(columnKey) {
  const column = getTaskTableColumn(columnKey);
  if (!column || column.sortable === false) return;

  if (currentTableSort.column === columnKey) {
    currentTableSort.direction =
      currentTableSort.direction === "asc" ? "desc" : "asc";
    return;
  }

  currentTableSort = {
    column: columnKey,
    direction: getDefaultTaskTableSortDirection(columnKey),
  };
}

function compareTableTextValues(left, right, direction) {
  const normalizedLeft = normalizeSearchText(left);
  const normalizedRight = normalizeSearchText(right);
  const comparison = normalizedLeft.localeCompare(normalizedRight);
  return direction === "desc" ? comparison * -1 : comparison;
}

function compareTableDateValues(left, right, direction) {
  const normalizedLeft = left || "";
  const normalizedRight = right || "";
  if (!normalizedLeft && !normalizedRight) return 0;
  if (!normalizedLeft) return 1;
  if (!normalizedRight) return -1;

  const comparison = normalizedLeft.localeCompare(normalizedRight);
  return direction === "desc" ? comparison * -1 : comparison;
}

function compareTableNumericValues(left, right, direction) {
  const comparison = Number(left || 0) - Number(right || 0);
  return direction === "desc" ? comparison * -1 : comparison;
}

function compareTaskTableTasks(a, b, fallbackSortMode) {
  const columnKey = currentTableSort.column;
  const direction = currentTableSort.direction || "asc";
  if (!columnKey) return compareTasks(a, b, fallbackSortMode);

  let comparison = 0;
  switch (columnKey) {
    case "title":
      comparison = compareTableTextValues(a.title, b.title, direction);
      break;
    case "category":
      comparison = compareTableTextValues(a.category, b.category, direction);
      break;
    case "priority":
      comparison = compareTableNumericValues(
        PRIORITY_ORDER[normalizePriority(a.priority)] ??
          PRIORITY_OPTIONS.length,
        PRIORITY_ORDER[normalizePriority(b.priority)] ??
          PRIORITY_OPTIONS.length,
        direction,
      );
      break;
    case "status":
      comparison = compareTableNumericValues(
        STATUS_ORDER[normalizeStatus(a.status)] ?? STATUS_OPTIONS.length,
        STATUS_ORDER[normalizeStatus(b.status)] ?? STATUS_OPTIONS.length,
        direction,
      );
      break;
    case "description":
      comparison = compareTableTextValues(
        a.description,
        b.description,
        direction,
      );
      break;
    case "quantity":
      comparison = compareTableNumericValues(
        getTaskCategoryCountWeight(a),
        getTaskCategoryCountWeight(b),
        direction,
      );
      break;
    case "sender":
      comparison = compareTableTextValues(a.sender, b.sender, direction);
      break;
    case "project":
      comparison = compareTableTextValues(a.project, b.project, direction);
      break;
    case "receivedAt":
    case "startedAt":
    case "completedAt":
      comparison = compareTableDateValues(
        a[columnKey],
        b[columnKey],
        direction,
      );
      break;
    default:
      comparison = 0;
  }

  return comparison || compareTasks(a, b, fallbackSortMode);
}

function getVisibleTasks(tasksToFilter, filters, options = {}) {
  const preserveVisibleIds =
    options.preserveVisibleIds instanceof Set
      ? options.preserveVisibleIds
      : new Set(
          Array.isArray(options.preserveVisibleIds)
            ? options.preserveVisibleIds
            : [],
        );

  return tasksToFilter.filter((task) => {
    const isPreserved = preserveVisibleIds.has(task.id);

    if (!isPreserved) {
      if (hideDone && isTaskCompleted(task)) return false;
      if (!hideDone && shouldAutoHideCompletedTask(task)) return false;
      if (filters.category && task.category !== filters.category) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.status && task.status !== filters.status) return false;
    }

    if (filters.search && !getTaskSearchText(task).includes(filters.search))
      return false;
    return true;
  });
}

function getTaskComparatorForView(viewMode, sortMode) {
  return viewMode === "table"
    ? (a, b) => compareTaskTableTasks(a, b, sortMode)
    : (a, b) => compareTasks(a, b, sortMode);
}

function buildRenderedTaskOrderIndex(referenceOrderIds = renderedTaskOrderIds) {
  const orderIndex = new Map();

  (Array.isArray(referenceOrderIds) ? referenceOrderIds : []).forEach(
    (taskId, index) => {
      if (!orderIndex.has(taskId)) {
        orderIndex.set(taskId, index);
      }
    },
  );

  return orderIndex;
}

function compareTasksByRenderedOrder(a, b, orderIndex, fallbackCompare) {
  const fallbackIndex = Number.MAX_SAFE_INTEGER;
  const aIndex = orderIndex.has(a.id) ? orderIndex.get(a.id) : fallbackIndex;
  const bIndex = orderIndex.has(b.id) ? orderIndex.get(b.id) : fallbackIndex;

  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }

  return fallbackCompare(a, b);
}

function orderVisibleTasks(visibleTasks, options = {}) {
  const activeViewMode = normalizeTaskViewMode(
    options.viewMode || currentViewMode,
  );
  const activeSortMode = normalizeTaskSortMode(
    options.sortMode || currentSortMode,
  );
  const compareWithinBucket = getTaskComparatorForView(
    activeViewMode,
    activeSortMode,
  );
  const referenceOrderIds = options.referenceOrderIds || renderedTaskOrderIds;
  const favoriteTasks = [];
  const standardTasks = [];

  visibleTasks.forEach((task) => {
    if (isTaskFavorite(task)) {
      favoriteTasks.push(task);
      return;
    }

    standardTasks.push(task);
  });

  if (options.preserveOrder) {
    const orderIndex = buildRenderedTaskOrderIndex(referenceOrderIds);
    favoriteTasks.sort((a, b) =>
      compareTasksByRenderedOrder(a, b, orderIndex, compareWithinBucket),
    );
    standardTasks.sort((a, b) =>
      compareTasksByRenderedOrder(a, b, orderIndex, compareWithinBucket),
    );
  } else {
    favoriteTasks.sort(compareWithinBucket);
    standardTasks.sort(compareWithinBucket);
  }

  return [...favoriteTasks, ...standardTasks];
}

function shouldPreserveTaskOrder(options = {}) {
  if (options.recomputeOrder) return false;
  if (options.preserveOrder) return true;
  return hasDeferredTaskSort;
}

function updateApplySortingButton() {
  const button = document.getElementById("applyTaskSortingBtn");
  if (!button) return;

  button.hidden = !hasDeferredTaskSort;
  button.disabled = !hasDeferredTaskSort;
}

function setTaskListViewMode(list, viewMode) {
  if (!list) return;

  list.classList.remove(...TASK_VIEW_OPTIONS.map((option) => `view-${option}`));
  list.classList.add(`view-${viewMode}`);
  list.dataset.viewMode = viewMode;
}

function setTaskWorkspaceViewMode(viewMode) {
  const workspaceGrid = document.getElementById("workspaceGrid");
  const detailPanel = document.getElementById("taskDetailPanel");
  const isTableView = viewMode === "table";

  workspaceGrid?.classList.toggle("is-table-view", isTableView);

  if (detailPanel) {
    detailPanel.classList.toggle("is-hidden", isTableView);
    detailPanel.setAttribute("aria-hidden", isTableView ? "true" : "false");
  }
}

function getTaskCardData(task) {
  const priority = normalizePriority(task.priority);
  const status = normalizeStatus(task.status);
  const priorityClass = `priority-${toClassToken(priority)}`;
  const statusClass = `status-${toClassToken(status)}`;
  const overdue = isOverdue(task.dueDate) && !isTaskCompleted(task);
  const categoryColor = getCategoryColor(task.category);
  const isActive = task.id === selectedTaskId;
  const isFavorite = isTaskFavorite(task);
  const logData = getLogPreview(task.id);
  const workflowItemCount = getItemsForTask(task.id).length;
  const { completedCount, subtaskCount } = getSubtaskProgress(task);
  const progressPercent = normalizeTaskProgressPercent(task.progressPercent);

  return {
    priority,
    status,
    priorityClass,
    statusClass,
    overdue,
    categoryColor,
    isActive,
    isFavorite,
    logData,
    workflowItemCount,
    completedCount,
    subtaskCount,
    progressPercent,
    progressLabel: formatTaskProgressLabel(progressPercent),
  };
}

function getTaskQuickActionsMarkup(task) {
  const favorite = isTaskFavorite(task);
  const favoriteLabel = favorite ? "Remove favorite" : "Mark as favorite";

  return `
        <div class="task-leading-actions">
          <button class="quick-toggle ${isTaskCompleted(task) ? "is-done" : ""}" type="button" data-toggle-complete="${task.id}" title="Toggle complete" aria-label="Toggle complete">${isTaskCompleted(task) ? "✓" : ""}</button>
          <button class="favorite-toggle ${favorite ? "is-active" : ""}" type="button" data-toggle-favorite="${task.id}" title="${favoriteLabel}" aria-label="${favoriteLabel}" aria-pressed="${favorite ? "true" : "false"}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.5-5-2.6-5 2.6.9-5.5-4-3.9 5.6-.8Z" />
            </svg>
          </button>
        </div>`;
}

function getStandardTaskCardMarkup(task, searchQuery = "") {
  const taskData = getTaskCardData(task);

  return `
        <div class="task-card ${taskData.priorityClass} ${taskData.statusClass} ${taskData.isFavorite ? "is-favorite" : ""} ${taskData.isActive ? "is-active" : ""}" data-id="${task.id}" style="--category-color:${escHtml(taskData.categoryColor)}">
          <div class="task-card-body">
            <div class="task-main">
              <div class="task-heading">
                ${getTaskQuickActionsMarkup(task)}
                ${getTaskMediaMarkup(task)}
                <div class="task-heading-main">
                  <div class="task-heading-top">
                    <div class="task-heading-copy">
                      ${getTaskTypeMarkup(task.category)}
                    </div>
                    ${getTaskActionToolsMarkup(task.id)}
                  </div>
                  <div class="task-title">${getHighlightedMarkup(task.title, searchQuery)}</div>
                  <div class="task-signal-row">
                    ${getTaskProjectMarkup(task.project, searchQuery)}
                    ${getTaskPriorityMarkup(taskData.priority)}
                  </div>
                  ${task.sender ? `<div class="task-sender-label">From: ${getHighlightedMarkup(task.sender, searchQuery)}</div>` : ""}
                  ${task.emailSubject ? `<div class="task-email-subject">Email: ${getHighlightedMarkup(task.emailSubject, searchQuery)}</div>` : ""}
                  <div class="task-progress-row" style="--task-progress:${taskData.progressPercent}%">
                    <div class="task-progress-summary">
                      <span class="task-progress-label">Progress</span>
                      <span class="task-progress-value">${escHtml(taskData.progressLabel)}</span>
                    </div>
                    <div class="task-progress-bar" aria-hidden="true"></div>
                  </div>
                  <div class="task-info-strip">
                    <div class="task-meta">
                      <span class="task-date">${taskData.workflowItemCount} item${taskData.workflowItemCount === 1 ? "" : "s"}</span>
                      <span class="task-date">${taskData.logData.count} log${taskData.logData.count === 1 ? "" : "s"}</span>
                      ${taskData.subtaskCount ? `<span class="task-date">${taskData.completedCount}/${taskData.subtaskCount} subtasks</span>` : ""}
                    </div>
                    <div class="task-preview-list">
                      <div class="task-preview-dates">
                        ${task.receivedAt ? `<div class="task-preview-date is-received"><span class="task-preview-date-label">Received</span><span class="task-preview-date-value">${escHtml(formatDate(task.receivedAt))}</span></div>` : ""}
                        ${task.startedAt ? `<div class="task-preview-date is-started"><span class="task-preview-date-label">Started</span><span class="task-preview-date-value">${escHtml(formatDate(task.startedAt))}</span></div>` : ""}
                        ${task.dueDate ? `<div class="task-preview-date is-due ${taskData.overdue ? "overdue" : ""}"><span class="task-preview-date-label">Due</span><span class="task-preview-date-value">${taskData.overdue ? "Overdue " : ""}${escHtml(formatDate(task.dueDate))}</span></div>` : ""}
                        ${task.completedAt ? `<div class="task-preview-date is-completed"><span class="task-preview-date-label">Completed</span><span class="task-preview-date-value">${escHtml(formatDate(task.completedAt))}</span></div>` : ""}
                      </div>
                    </div>
                  </div>
                  <div class="task-description-block ${task.description ? "" : "is-empty"}">${task.description ? getHighlightedMarkup(task.description, searchQuery) : "No description"}</div>
                </div>
              </div>
            </div>
            <div class="task-actions">
              <div class="task-action-item is-wide">
                <span class="task-action-label">Priority</span>
                <select class="priority-select" data-id="${task.id}" title="Change priority">
                  ${buildOptionMarkup(PRIORITY_OPTIONS, taskData.priority)}
                </select>
              </div>
              <div class="task-action-item is-wide">
                <span class="task-action-label">Status</span>
                <select class="status-select" data-id="${task.id}" title="Change status">
                  ${buildOptionMarkup(STATUS_OPTIONS, taskData.status)}
                </select>
              </div>
              <div class="task-action-status">
                ${getFilterBadgeMarkup("status", taskData.status)}
              </div>
            </div>
          </div>
        </div>`;
}

function getCompactTaskCardMarkup(task, searchQuery = "") {
  const taskData = getTaskCardData(task);
  const compactDateMarkup = [
    task.receivedAt
      ? `<div class="task-preview-date is-received"><span class="task-preview-date-label">Received</span><span class="task-preview-date-value">${escHtml(formatDate(task.receivedAt))}</span></div>`
      : "",
    task.dueDate
      ? `<div class="task-preview-date is-due ${taskData.overdue ? "overdue" : ""}"><span class="task-preview-date-label">Due</span><span class="task-preview-date-value">${taskData.overdue ? "Overdue " : ""}${escHtml(formatDate(task.dueDate))}</span></div>`
      : "",
    task.completedAt
      ? `<div class="task-preview-date is-completed"><span class="task-preview-date-label">Completed</span><span class="task-preview-date-value">${escHtml(formatDate(task.completedAt))}</span></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
        <div class="task-card task-card-compact ${compactDateMarkup ? "has-compact-dates" : ""} ${taskData.priorityClass} ${taskData.statusClass} ${taskData.isFavorite ? "is-favorite" : ""} ${taskData.isActive ? "is-active" : ""}" data-id="${task.id}" style="--category-color:${escHtml(taskData.categoryColor)}">
          <div class="task-card-body">
            <div class="task-main">
              <div class="task-heading">
                ${getTaskQuickActionsMarkup(task)}
                ${getTaskMediaMarkup(task)}
                <div class="task-heading-main">
                  <div class="task-heading-top">
                    <div class="task-heading-copy">
                      ${getTaskTypeMarkup(task.category)}
                    </div>
                    ${getTaskActionToolsMarkup(task.id)}
                  </div>
                  <div class="task-title">${getHighlightedMarkup(task.title, searchQuery)}</div>
                  <div class="task-signal-row">
                    ${getTaskProjectMarkup(task.project, searchQuery)}
                    ${getTaskPriorityMarkup(taskData.priority)}
                  </div>
                  <div class="task-progress-row" style="--task-progress:${taskData.progressPercent}%">
                    <div class="task-progress-summary">
                      <span class="task-progress-label">Progress</span>
                      <span class="task-progress-value">${escHtml(taskData.progressLabel)}</span>
                    </div>
                    <div class="task-progress-bar" aria-hidden="true"></div>
                  </div>
                </div>
              </div>
              ${compactDateMarkup ? `<div class="task-compact-dates-column"><div class="task-preview-dates">${compactDateMarkup}</div></div>` : ""}
            </div>
            <div class="task-actions task-actions-compact">
              <div class="task-action-status">
                ${getFilterBadgeMarkup("status", taskData.status)}
              </div>
            </div>
          </div>
        </div>`;
}

function getTaskTableDateMarkup(label, value) {
  return `
        <div class="task-table-date-wrap">
          <span class="task-table-date-label">${escHtml(label)}</span>
          <span class="task-table-date-value">${value ? escHtml(formatDate(value)) : "—"}</span>
        </div>`;
}

function getTaskTableActionToolsMarkup(taskId) {
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

function getTaskTableHeaderMarkup(column) {
  const isSortable = column.sortable !== false;
  const isActive = currentTableSort.column === column.key;
  const direction = isActive
    ? currentTableSort.direction
    : getDefaultTaskTableSortDirection(column.key);
  const ariaSort = isSortable
    ? isActive
      ? direction === "asc"
        ? "ascending"
        : "descending"
      : "none"
    : null;
  const headerClasses = ["task-table-head"];
  if (column.headerClass) headerClasses.push(column.headerClass);

  return `
        <th scope="col" class="${headerClasses.join(" ")}" style="width:${escHtml(column.width)}"${ariaSort ? ` aria-sort="${ariaSort}"` : ""}>
          ${
            isSortable
              ? `
            <button class="task-table-sort-btn ${isActive ? "is-active" : ""}" type="button" data-table-sort="${escHtml(column.key)}" aria-label="Sort by ${escHtml(column.label)} ${isActive ? (direction === "asc" ? "descending" : "ascending") : direction === "asc" ? "ascending" : "descending"}">
              <span>${escHtml(column.label)}</span>
              <span class="task-table-sort-indicator" aria-hidden="true">${isActive ? (direction === "asc" ? "Asc" : "Desc") : "Sort"}</span>
            </button>`
              : `<span class="task-table-sort-label">${escHtml(column.label)}</span>`
          }
        </th>`;
}

function getTaskTableCellMarkup(task, column, taskData, searchQuery = "") {
  const quantity = getTaskCategoryCountWeight(task);
  const cellClasses = ["task-table-cell"];
  const innerClasses = ["task-table-cell-inner"];
  if (column.cellClass) {
    cellClasses.push(column.cellClass);
    innerClasses.push(column.cellClass);
  }

  let content = "";
  switch (column.key) {
    case "title":
      content = `
            <div class="task-table-title-wrap">
              <div class="task-table-title-top">
                ${getTaskQuickActionsMarkup(task)}
                ${getTaskMediaMarkup(task)}
                <div class="task-table-title-main">
                  <h3 class="task-table-title">${getHighlightedMarkup(task.title, searchQuery)}</h3>
                </div>
              </div>
            </div>`;
      break;
    case "category":
      content = getCategoryMarkup(task.category);
      break;
    case "priority":
      content = getFilterBadgeMarkup("priority", taskData.priority);
      break;
    case "status":
      content = getFilterBadgeMarkup("status", taskData.status);
      break;
    case "description":
      content = `<div class="task-table-text is-description">${task.description ? getHighlightedMarkup(task.description, searchQuery) : '<span class="task-table-text is-muted">No description</span>'}</div>`;
      break;
    case "quantity":
      content = `<div class="task-table-text">${escHtml(String(quantity))}</div>`;
      break;
    case "sender":
      content = `<div class="task-table-text">${task.sender ? getHighlightedMarkup(task.sender, searchQuery) : '<span class="task-table-text is-muted">No sender</span>'}</div>`;
      break;
    case "project":
      content = task.project
        ? getTaskProjectMarkup(task.project, searchQuery)
        : '<span class="task-table-text is-muted">No project</span>';
      break;
    case "receivedAt":
      content = getTaskTableDateMarkup("Received", task.receivedAt);
      break;
    case "startedAt":
      content = getTaskTableDateMarkup("Started", task.startedAt);
      break;
    case "completedAt":
      content = getTaskTableDateMarkup("Completed", task.completedAt);
      break;
    case "actions":
      content = `<div class="task-table-actions task-actions">${getTaskTableActionToolsMarkup(task.id)}</div>`;
      break;
    default:
      content = '<span class="task-table-text is-muted">-</span>';
  }

  return `<td class="${cellClasses.join(" ")}"><div class="${innerClasses.join(" ")}">${content}</div></td>`;
}

function getTableTaskRowMarkup(task, searchQuery = "") {
  const taskData = getTaskCardData(task);
  return `
        <tr class="task-table-row ${taskData.priorityClass} ${taskData.statusClass} ${taskData.isFavorite ? "is-favorite" : ""} ${taskData.isActive ? "is-active" : ""}" data-task-row="${task.id}" data-id="${task.id}" style="--category-color:${escHtml(taskData.categoryColor)}">
          ${TASK_TABLE_COLUMNS.map((column) => getTaskTableCellMarkup(task, column, taskData, searchQuery)).join("")}
        </tr>`;
}

function getTableTaskListMarkup(tasksToRender, searchQuery = "") {
  return `
        <div class="task-table-shell">
          <table class="task-data-table" aria-label="Task overview table">
            <colgroup>
              ${TASK_TABLE_COLUMNS.map((column) => `<col style="width:${escHtml(column.width)}">`).join("")}
            </colgroup>
            <thead>
              <tr>
                ${TASK_TABLE_COLUMNS.map((column) => getTaskTableHeaderMarkup(column)).join("")}
              </tr>
            </thead>
            <tbody>
              ${tasksToRender.map((task) => getTableTaskRowMarkup(task, searchQuery)).join("")}
            </tbody>
          </table>
        </div>`;
}

function renderTaskListMarkup(tasksToRender, searchQuery = "") {
  if (currentViewMode === "table") {
    return getTableTaskListMarkup(tasksToRender, searchQuery);
  }

  if (currentViewMode === "compact") {
    return tasksToRender
      .map((task) => getCompactTaskCardMarkup(task, searchQuery))
      .join("");
  }

  return tasksToRender
    .map((task) => getStandardTaskCardMarkup(task, searchQuery))
    .join("");
}
