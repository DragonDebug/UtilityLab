    function renderStats() {
      const openTasks = tasks.filter(task => !isTaskCompleted(task));
      const total   = openTasks.length;
      const ongoing = openTasks.filter(task => normalizeStatus(task.status) === 'Ongoing').length;
      const done    = tasks.filter(task => isTaskCompleted(task)).length;
      const attention = openTasks.filter(task => ATTENTION_PRIORITIES.has(normalizePriority(task.priority))).length;
      const statusStats = STATUS_OPTIONS
        .filter(status => status !== 'Completed')
        .map(status => ({
        label: status,
        filterType: 'status',
        filterValue: status,
        value: openTasks.filter(task => normalizeStatus(task.status) === status).length,
        accent: STATUS_ACCENTS[status] || 'var(--accent)',
        itemClass: `is-${toClassToken(status)}`
      }));
      const priorityStats = PRIORITY_OPTIONS.map(priority => ({
        label: priority,
        filterType: 'priority',
        filterValue: priority,
        value: openTasks.filter(task => normalizePriority(task.priority) === priority).length,
        accent: PRIORITY_ACCENTS[priority] || 'var(--accent)',
        itemClass: `is-${toClassToken(priority)}`
      }));
      const categoryStats = categories.map(category => ({
        label: category.name,
        filterType: 'category',
        filterValue: category.name,
        value: openTasks
          .filter(task => task.category === category.name)
          .reduce((sum, task) => sum + getTaskCategoryCountWeight(task), 0),
        accent: category.color,
        itemClass: 'is-category'
      }));
      const categoryUnits = categoryStats.reduce((sum, item) => sum + item.value, 0);
      const CATEGORY_STATS_PAGE_SIZE = 15;
      const totalCategoryPages = Math.max(1, Math.ceil(categoryStats.length / CATEGORY_STATS_PAGE_SIZE));
      activeCategoryStatsPage = Math.min(activeCategoryStatsPage, totalCategoryPages - 1);

      document.getElementById('taskStats').innerHTML = `
        <div class="stat-chip" style="--chip-accent:var(--accent-h)">
          <span class="stat-label">Open Tasks</span>
          <strong class="stat-value">${total}</strong>
          <span class="stat-hint">Open work only</span>
        </div>
        <div class="stat-chip" style="--chip-accent:var(--accent)">
          <span class="stat-label">Ongoing Tasks</span>
          <strong class="stat-value">${ongoing}</strong>
          <span class="stat-hint">Actively in progress</span>
        </div>
        <div class="stat-chip" style="--chip-accent:var(--text-muted)">
          <span class="stat-label">Completed</span>
          <strong class="stat-value">${done}</strong>
          <span class="stat-hint">Closed out</span>
        </div>
        <div class="stat-chip" style="--chip-accent:var(--critical)">
          <span class="stat-label">High / Critical</span>
          <strong class="stat-value" style="color:var(--critical)">${attention}</strong>
          <span class="stat-hint">Open urgent work</span>
        </div>
      `;

      const secondaryGroups = [
        {
          id: 'status',
          title: 'Status',
          accent: 'var(--status-ongoing)',
          summary: `${total} open task${total === 1 ? '' : 's'} across ${statusStats.length} statuses`,
          items: statusStats
        },
        {
          id: 'priority',
          title: 'Priority',
          accent: 'var(--medium)',
          summary: `${total} open task${total === 1 ? '' : 's'} across ${priorityStats.length} priorities`,
          items: priorityStats
        },
        {
          id: 'category',
          title: 'Category',
          accent: 'var(--accent)',
          summary: `${categoryUnits} open unit${categoryUnits === 1 ? '' : 's'} across ${categoryStats.length} categor${categoryStats.length === 1 ? 'y' : 'ies'}`,
          items: categoryStats
        }
      ];

      if (!secondaryGroups.some(group => group.id === activeSecondaryStatsTab)) {
        activeSecondaryStatsTab = secondaryGroups[0]?.id || 'status';
        saveActiveSecondaryStatsTabPreference();
      }

      const activeSecondaryGroup = secondaryGroups.find(group => group.id === activeSecondaryStatsTab) || secondaryGroups[0];
      const secondaryTitle = document.getElementById('taskStatsSecondaryTitle');
      const secondaryCaption = document.getElementById('taskStatsSecondaryCaption');

      if (secondaryTitle && activeSecondaryGroup) {
        secondaryTitle.textContent = `${activeSecondaryGroup.title} breakdown`;
      }
      if (secondaryCaption && activeSecondaryGroup) {
        secondaryCaption.textContent = activeSecondaryGroup.summary;
      }

      document.getElementById('taskStatsSecondaryTabs').innerHTML = secondaryGroups.map(group => `
            <button
              type="button"
              class="btn task-stats-secondary-tab ${group.id === activeSecondaryStatsTab ? 'is-active' : ''}"
              style="--tab-accent:${group.accent}"
              data-stats-tab="${group.id}"
              role="tab"
              aria-selected="${group.id === activeSecondaryStatsTab ? 'true' : 'false'}"
              aria-controls="stats-group-${group.id}"
            >
              <span class="task-stats-secondary-tab-label">${group.title}</span>
              <span class="task-stats-secondary-tab-count">${group.items.length}</span>
            </button>`).join('');

      document.getElementById('taskStatsSecondary').innerHTML = `${secondaryGroups.map(group => {
        const isCategoryGroup = group.id === 'category';
        const pageStart = activeCategoryStatsPage * CATEGORY_STATS_PAGE_SIZE;
        const pageItems = isCategoryGroup
          ? group.items.slice(pageStart, pageStart + CATEGORY_STATS_PAGE_SIZE)
          : group.items;
        const pageEnd = isCategoryGroup ? Math.min(group.items.length, pageStart + CATEGORY_STATS_PAGE_SIZE) : group.items.length;
        const hasCategoryPager = isCategoryGroup && group.items.length > CATEGORY_STATS_PAGE_SIZE;

        return `
        <section class="stats-group stats-group--${group.id} ${group.id === activeSecondaryStatsTab ? 'is-active' : ''}" id="stats-group-${group.id}" style="--group-accent:${group.accent}" role="tabpanel" ${group.id === activeSecondaryStatsTab ? '' : 'hidden'}>
          ${hasCategoryPager ? `
          <div class="stats-group-toolbar">
            <span class="stats-group-page-meta">Showing ${pageStart + 1}-${pageEnd} of ${group.items.length}</span>
            <div class="stats-group-page-controls">
              <button type="button" class="btn btn-ghost stats-group-page-btn" data-category-page-dir="prev" ${activeCategoryStatsPage === 0 ? 'disabled' : ''}>Previous</button>
              <button type="button" class="btn btn-ghost stats-group-page-btn" data-category-page-dir="next" ${activeCategoryStatsPage >= totalCategoryPages - 1 ? 'disabled' : ''}>Next</button>
            </div>
          </div>` : ''}
          <div class="stats-group-list">
            ${pageItems.map(stat => `
              <div
                class="micro-stat ${stat.itemClass || ''}"
                style="--micro-accent:${stat.accent || group.accent}"
              >
                <span class="micro-stat-label">${escHtml(stat.label)}</span>
                <strong class="micro-stat-value">${stat.value}</strong>
              </div>`).join('')}
          </div>
        </section>`;
      }).join('')}`;

      updateSecondaryStatsToggle();
    }

    function renderCategoryOptions() {
      const taskCategory = document.getElementById('taskCategory');
      const filterCategory = document.getElementById('filterCategory');
      const currentTaskValue = taskCategory?.value;
      const currentFilterValue = filterCategory?.value;
      const optionHtml = categories.map(category => `
        <option value="${escHtml(category.name)}">${escHtml(category.name)}</option>`).join('');

      if (taskCategory) {
        taskCategory.innerHTML = optionHtml;
        taskCategory.value = getCategoryByName(currentTaskValue)?.name || categories[0]?.name || '';
      }

      if (filterCategory) {
        filterCategory.innerHTML = `<option value="">All Categories</option>${optionHtml}`;
        filterCategory.value = getCategoryByName(currentFilterValue)?.name || '';
      }

      syncTaskModalFieldAccents();
      renderTaskProjectOptions();
    }

    function renderCategoryList() {
      const list = document.getElementById('categoryList');
      if (!list) return;

      list.innerHTML = categories.map(category => {
        const isLocked = isProtectedCategory(category.name);
        const categoryIndex = categories.findIndex(item => item.name === category.name);
        const canMoveUp = !isLocked && categoryIndex > 1;
        const canMoveDown = !isLocked && categoryIndex < categories.length - 1;
        return `
          <div class="category-item">
            <div class="category-item-main">
              <span class="category-dot" style="--category-color:${escHtml(category.color)}"></span>
              <div class="category-item-summary">
                <div class="category-item-name">${escHtml(category.name)}</div>
                <div class="category-item-meta">${escHtml(category.color)}</div>
              </div>
            </div>
            ${isLocked
              ? '<div class="category-item-locked">Required</div>'
              : `<div class="category-item-actions">
                  <div class="category-move-actions" aria-label="Reorder category">
                    <button class="btn btn-ghost category-move-btn" type="button" data-move-category="${escHtml(category.name)}" data-move-direction="up" ${canMoveUp ? '' : 'disabled'} aria-label="Move category up" title="Move up">↑</button>
                    <button class="btn btn-ghost category-move-btn" type="button" data-move-category="${escHtml(category.name)}" data-move-direction="down" ${canMoveDown ? '' : 'disabled'} aria-label="Move category down" title="Move down">↓</button>
                  </div>
                  <button class="btn btn-ghost task-open-btn" type="button" data-edit-category="${escHtml(category.name)}">Edit</button>
                  <button class="btn btn-danger" type="button" data-delete-category="${escHtml(category.name)}">Delete</button>
                </div>`}
          </div>`;
      }).join('');
    }

    function renderTemplateOptions() {
      const taskTemplate = document.getElementById('taskTemplate');
      if (!taskTemplate) return;
      const currentValue = taskTemplate.value;
      taskTemplate.innerHTML = `<option value="">No Template</option>${templates.map(template => `
        <option value="${escHtml(template.id)}">${escHtml(template.name)}</option>`).join('')}`;
      taskTemplate.value = getTemplateById(currentValue)?.id || '';
    }

    function renderTemplateList() {
      const list = document.getElementById('templateList');
      if (!list) return;

      if (!templates.length) {
        list.innerHTML = '<div class="log-empty">No templates yet.</div>';
        return;
      }

      list.innerHTML = templates.map(template => `
        <div class="template-item">
          <div class="template-item-header">
            <div class="template-item-summary">
              <div class="template-item-name">${escHtml(template.name)}</div>
              <div class="category-item-meta">${template.subtasks.length} subtask${template.subtasks.length === 1 ? '' : 's'}</div>
            </div>
            <div class="task-actions">
              <button class="btn btn-ghost task-open-btn" type="button" data-edit-template="${template.id}">Edit</button>
              <button class="btn btn-danger" type="button" data-delete-template="${template.id}">Delete</button>
            </div>
          </div>
          <div class="template-subtask-preview">
            ${template.subtasks.length ? template.subtasks.map(item => `<span>${escHtml(item)}</span>`).join('') : '<span>No subtasks defined.</span>'}
          </div>
        </div>`).join('');
    }

    // ── Render Task List ──
    // Master render function: refreshes stats, filters, sorts, then rebuilds
    // the task card list and the detail panel for the selected task.
    function renderTasks(options = {}) {
      const detailPanel = document.getElementById('taskDetailPanel');
      const itemsModalShell = document.querySelector('#itemsModal .workflow-item-list-shell');
      const detailScrollTop = options.preserveDetailScroll ? getScrollTop(detailPanel) : 0;
      const itemsModalScrollTop = options.preserveItemsModalScroll ? getScrollTop(itemsModalShell) : 0;

      renderStats();
      renderCategoryOptions();
      renderTemplateOptions();
      renderTaskOptionSets();

      const filters = getCurrentFilters();
      const activeViewMode = normalizeTaskViewMode(currentViewMode);
      const preserveOrder = shouldPreserveTaskOrder(options);
      const preserveVisibleIds = preserveOrder && options.recomputeOrder !== true
        ? renderedTaskOrderIds
        : undefined;
      currentViewMode = activeViewMode;

      let visible = getVisibleTasks(tasks, filters, { preserveVisibleIds });

      if (options.recomputeOrder) {
        hasDeferredTaskSort = false;
      } else if (options.preserveOrder) {
        hasDeferredTaskSort = true;
      }

      const list = document.getElementById('taskList');
      setTaskListViewMode(list, activeViewMode);
      setTaskWorkspaceViewMode(activeViewMode);
      updateApplySortingButton();

      if (visible.length === 0) {
        selectedTaskId = null;
        renderedTaskOrderIds = [];
        list.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
            </svg>
            <p>No tasks found</p>
            <small>${tasks.length === 0 ? 'Create your first task with the button above, or start from a reusable template.' : 'Try adjusting your filters to bring matching tasks back into view.'}</small>
          </div>`;
        renderTaskDetails({ preserveScrollTop: detailScrollTop });
        return;
      }

      visible = orderVisibleTasks(visible, {
        preserveOrder,
        sortMode: filters.sort,
        viewMode: activeViewMode
      });

      renderedTaskOrderIds = visible.map(task => task.id);

      if (!visible.some(task => task.id === selectedTaskId)) {
        selectedTaskId = visible[0]?.id || null;
      }

      list.innerHTML = renderTaskListMarkup(visible, filters.search);

      renderTaskDetails({ preserveScrollTop: detailScrollTop });

      if (document.getElementById('itemsModal')?.classList.contains('open')) {
        renderAllItemsList({ preserveScrollTop: itemsModalScrollTop });
      }
    }

    function renderTaskDetails(options = {}) {
      const panel = document.getElementById('taskDetailPanel');
      const preserveScrollTop = options.preserveScrollTop;
      const preservedChildScrolls = captureChildScrollPositions(panel, ['.subtask-list-shell', '.workflow-item-list-shell']);
      closeDetailContextMenu();
      const task = getTaskById(selectedTaskId);

      if (!task) {
        panel.innerHTML = `
          <div class="detail-empty">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
                <path d="M8 3.5h8l4 4V20a1 1 0 0 1-1 1H8a4 4 0 0 1-4-4V7.5a4 4 0 0 1 4-4Z"/>
                <path d="M16 3.5V8h4"/>
                <path d="M8.5 12h7"/>
                <path d="M8.5 15.5h7"/>
              </svg>
              <p>Select a task to open the detail pane</p>
              <small>Notes, subtasks, timestamps, and log history appear here once you choose a task from the queue.</small>
            </div>
          </div>`;
        restoreScrollTop(panel, preserveScrollTop);
        restoreChildScrollPositions(panel, preservedChildScrolls);
        return;
      }

      const taskLogs = getLogsByTaskId(task.id);
      const priority = normalizePriority(task.priority);
      const status = normalizeStatus(task.status);
      const dueClass = isOverdue(task.dueDate) && !isTaskCompleted(task) ? 'overdue' : '';
      const categoryColor = getCategoryColor(task.category);
      const template = getTemplateById(task.templateId);
      const subtaskCount = task.subtasks?.length || 0;
      const completedSubtasks = (task.subtasks || []).filter(subtask => subtask.done).length;
      const openSubtasks = Math.max(subtaskCount - completedSubtasks, 0);
      const subtaskCompletionPercent = getSubtaskCompletionPercent(task);
      const progressPercent = normalizeTaskProgressPercent(task.progressPercent);
      const workflowItemCount = getItemsForTask(task.id).length;
      const isEditingDescription = activeDetailEditTaskId === task.id && activeDetailEditField === 'description';
      const isEditingNotes = activeDetailEditTaskId === task.id && activeDetailEditField === 'notes';

      if (activeSubtaskEditTaskId === task.id && activeSubtaskEditId && !(task.subtasks || []).some(subtask => subtask.id === activeSubtaskEditId)) {
        clearActiveSubtaskEdit();
      }

      const detailTabs = [
        {
          id: 'description',
          label: 'Description',
          accent: 'var(--accent)',
          meta: null,
          panelClass: 'detail-description',
          content: `
            <div class="detail-section-header">
              <div class="section-title">Description</div>
              <div class="detail-section-actions">
                <span class="detail-section-meta">${isEditingDescription ? 'Editing' : (task.description ? 'Summary' : 'No description')}</span>
                ${isEditingDescription ? '' : '<button type="button" class="btn btn-ghost" data-edit-detail-field="description">Edit</button>'}
              </div>
            </div>
            <div class="detail-section-body">
              ${isEditingDescription ? `
                <form class="detail-inline-editor-wrap" data-detail-edit-form="description">
                  <textarea class="detail-inline-editor" data-detail-edit-input="description" placeholder="Add a clear task description or context...">${escHtml(task.description || '')}</textarea>
                  <div class="detail-inline-editor-actions">
                    <button type="button" class="btn btn-ghost" data-cancel-detail-edit="description">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                  </div>
                </form>` : `
                <div class="detail-inline-view ${task.description ? '' : 'is-empty'}">
                  <p>${task.description ? escHtml(task.description) : 'No description added for this task yet.'}</p>
                </div>`}
            </div>`
        },
        ...(task.imageDataUrl ? [{
          id: 'image',
          label: 'Image',
          accent: '#0ea5e9',
          meta: null,
          panelClass: 'detail-image-section',
          content: getTaskDetailMediaMarkup(task)
        }] : []),
        {
          id: 'schedule',
          label: 'Schedule',
          accent: '#14b8a6',
          meta: formatTaskProgressLabel(progressPercent),
          panelClass: 'detail-schedule',
          content: `
            <div class="detail-section-header">
              <div class="section-title">Schedule & Progress</div>
              <span class="detail-section-meta">Dates save as you edit them</span>
            </div>
            <div class="detail-section-body detail-schedule-panel">
              <div class="detail-schedule-grid">
                <div class="detail-schedule-field" style="--field-accent:#14b8a6">
                  <label for="detailReceivedAt">Received</label>
                  <input type="date" id="detailReceivedAt" data-task-detail-field="receivedAt" value="${escHtml(task.receivedAt || '')}" />
                </div>
                <div class="detail-schedule-field" style="--field-accent:#ef7d57">
                  <label for="detailDueDate">Due</label>
                  <input type="date" id="detailDueDate" data-task-detail-field="dueDate" value="${escHtml(task.dueDate || '')}" />
                </div>
                <div class="detail-schedule-field" style="--field-accent:#3b82f6">
                  <label for="detailStartedAt">Started</label>
                  <input type="date" id="detailStartedAt" data-task-detail-field="startedAt" value="${escHtml(task.startedAt || '')}" />
                </div>
                <div class="detail-schedule-field" style="--field-accent:#64748b">
                  <label for="detailCompletedAt">Completed</label>
                  <input type="date" id="detailCompletedAt" data-task-detail-field="completedAt" value="${escHtml(task.completedAt || '')}" />
                </div>
                <div class="detail-schedule-field is-full" style="--field-accent:#14b8a6">
                  <label for="detailProgressPercent">Task progress</label>
                  <input type="number" id="detailProgressPercent" min="0" max="100" step="1" inputmode="numeric" data-task-detail-field="progressPercent" value="${escHtml(String(progressPercent))}" />
                  <div class="detail-schedule-progress-preview" style="--task-progress:${progressPercent}%">
                    <div class="detail-schedule-progress-meta">
                      <span>Manual progress shown on task cards</span>
                      <strong>${escHtml(formatTaskProgressLabel(progressPercent))}</strong>
                    </div>
                    <div class="task-progress-bar" aria-hidden="true"></div>
                  </div>
                  <div class="detail-schedule-help">Completed tasks automatically snap progress to 100%.</div>
                </div>
              </div>
            </div>`
        },
        {
          id: 'subtasks',
          label: 'Subtasks',
          accent: 'var(--medium)',
          meta: `${completedSubtasks}/${subtaskCount} complete`,
          panelClass: 'subtasks-section',
          content: `
            <div class="detail-section-header">
              <div class="section-title">Subtasks</div>
              <span class="detail-section-meta">${completedSubtasks}/${subtaskCount} complete</span>
            </div>
            ${subtaskCount ? `
              <div class="subtask-summary" style="--subtask-progress:${subtaskCompletionPercent}%">
                <div class="subtask-summary-top">
                  <div class="subtask-summary-copy">
                    <span class="subtask-summary-title">${openSubtasks} open</span>
                    <span class="subtask-summary-meta">${completedSubtasks} complete · ${subtaskCompletionPercent}% done</span>
                  </div>
                  <div class="subtask-batch-actions">
                    <button type="button" class="btn btn-ghost subtask-batch-btn" data-subtask-batch="complete-all" ${openSubtasks ? '' : 'disabled'}>Mark All Done</button>
                    <button type="button" class="btn btn-ghost subtask-batch-btn" data-subtask-batch="reopen-all" ${completedSubtasks ? '' : 'disabled'}>Mark All Open</button>
                    <button type="button" class="btn btn-ghost subtask-batch-btn" data-subtask-batch="clear-completed" ${completedSubtasks ? '' : 'disabled'}>Clear Completed</button>
                  </div>
                </div>
                <div class="subtask-progress-bar" aria-hidden="true"></div>
              </div>` : ''}
            <form class="subtask-form" id="subtaskForm">
              <textarea id="subtaskTitle" class="subtask-input" placeholder="Add one subtask per line..." required></textarea>
              <button type="submit" class="btn btn-primary">Add Subtasks</button>
            </form>
            ${task.subtasks?.length ? `
              <div class="subtask-list-shell">
                <div class="subtask-list">
                  ${task.subtasks.map((subtask, index) => `
                    <div class="subtask-item ${subtask.done ? 'is-done' : ''} ${activeSubtaskEditTaskId === task.id && activeSubtaskEditId === subtask.id ? 'is-editing' : ''}">
                      <div class="subtask-item-main">
                        <input id="subtask-toggle-${subtask.id}" type="checkbox" data-toggle-subtask="${subtask.id}" ${subtask.done ? 'checked' : ''} ${activeSubtaskEditTaskId === task.id && activeSubtaskEditId === subtask.id ? 'disabled' : ''} />
                        ${activeSubtaskEditTaskId === task.id && activeSubtaskEditId === subtask.id ? `
                          <form class="subtask-inline-form" data-subtask-edit-form="${subtask.id}">
                            <input type="text" class="subtask-inline-input" data-subtask-edit-input="${subtask.id}" value="${escHtml(subtask.title)}" maxlength="${INPUT_LIMITS.subtaskTitle}" />
                            <div class="subtask-inline-actions">
                              <button type="submit" class="btn btn-primary subtask-inline-btn">Save</button>
                              <button type="button" class="btn btn-ghost subtask-inline-btn" data-cancel-subtask-edit="${subtask.id}">Cancel</button>
                            </div>
                          </form>` : `
                          <label class="subtask-item-title" for="subtask-toggle-${subtask.id}">${escHtml(subtask.title)}</label>`}
                      </div>
                      ${activeSubtaskEditTaskId === task.id && activeSubtaskEditId === subtask.id ? '' : `
                        <div class="subtask-item-actions">
                          <button type="button" class="btn btn-ghost subtask-edit-btn" data-edit-subtask="${subtask.id}">Edit</button>
                          <button type="button" class="btn btn-ghost subtask-move-btn" data-move-subtask="${subtask.id}" data-move-direction="up" ${index === 0 ? 'disabled' : ''} aria-label="Move subtask up" title="Move up">↑</button>
                          <button type="button" class="btn btn-ghost subtask-move-btn" data-move-subtask="${subtask.id}" data-move-direction="down" ${index === task.subtasks.length - 1 ? 'disabled' : ''} aria-label="Move subtask down" title="Move down">↓</button>
                          <button type="button" class="btn btn-danger subtask-delete-btn" data-delete-subtask="${subtask.id}">Remove</button>
                        </div>`}
                    </div>`).join('')}
                </div>
              </div>` : '<div class="subtask-empty">No subtasks yet. Add one above.</div>'}`
        },
        {
          id: 'items',
          label: 'Items',
          accent: '#14b8a6',
          meta: `${workflowItemCount} item${workflowItemCount === 1 ? '' : 's'}`,
          panelClass: 'workflow-items-section',
          content: getWorkflowItemsSectionMarkup(task)
        },
        {
          id: 'logs',
          label: 'Logs',
          accent: 'var(--status-ongoing)',
          meta: `${taskLogs.length} entr${taskLogs.length === 1 ? 'y' : 'ies'}`,
          panelClass: 'logs-section',
          content: `
            <div class="detail-section-header">
              <div class="section-title">Logs</div>
              <span class="detail-section-meta">${taskLogs.length} entr${taskLogs.length === 1 ? 'y' : 'ies'}</span>
            </div>
            <form class="logs-form" id="logForm">
              <textarea id="logContent" class="log-input" placeholder="Write a clear progress update, handoff note, or follow-up..." required></textarea>
              <div class="logs-meta">
                <span>Entries stay linked to this task in this browser.</span>
                <button type="submit" class="btn btn-primary log-submit-btn">Add Log</button>
              </div>
            </form>
            <div class="log-list-shell">
              <div class="log-list">
                ${taskLogs.length ? taskLogs.map(log => getLogEntryMarkup(log)).join('') : '<div class="log-empty">No logs yet for this task.</div>'}
              </div>
            </div>`
        },
        {
          id: 'notes',
          label: 'Notes',
          accent: 'var(--low)',
          meta: null,
          panelClass: 'detail-notes',
          content: `
            <div class="detail-section-header">
              <div class="section-title">Task Notes</div>
              <div class="detail-section-actions">
                <span class="detail-section-meta">${isEditingNotes ? 'Editing' : (task.notes ? 'Reference' : 'No notes')}</span>
                ${isEditingNotes ? '' : '<button type="button" class="btn btn-ghost" data-edit-detail-field="notes">Edit</button>'}
              </div>
            </div>
            <div class="detail-section-body">
              ${isEditingNotes ? `
                <form class="detail-inline-editor-wrap" data-detail-edit-form="notes">
                  <textarea class="detail-inline-editor" data-detail-edit-input="notes" placeholder="Add notes, handoff context, or reminders...">${escHtml(task.notes || '')}</textarea>
                  <div class="detail-inline-editor-actions">
                    <button type="button" class="btn btn-ghost" data-cancel-detail-edit="notes">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                  </div>
                </form>` : `
                <div class="detail-inline-view ${task.notes ? '' : 'is-empty'}">
                  <p>${task.notes ? escHtml(task.notes) : 'No notes added for this task yet.'}</p>
                </div>`}
            </div>`
        }
      ];
      const availableTabIds = new Set(detailTabs.map(tab => tab.id));

      if (!availableTabIds.has(activeDetailTab)) {
        activeDetailTab = detailTabs[0]?.id || 'description';
      }

      panel.innerHTML = `
        <div class="detail-header" style="--category-color:${escHtml(categoryColor)}">
          <div class="detail-header-main">
            <div class="section-title">Task Details</div>
            <div class="detail-title">${escHtml(task.title)}</div>
            <div class="task-meta">
              ${getCategoryMarkup(task.category)}
              ${getFilterBadgeMarkup('priority', priority)}
              ${getFilterBadgeMarkup('status', status)}
              <span class="badge badge-category" style="--category-color:#14b8a6">${workflowItemCount} item${workflowItemCount === 1 ? '' : 's'}</span>
              ${template ? `<span class="badge badge-category" style="--category-color:${escHtml(categoryColor)}">Template: ${escHtml(template.name)}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-ghost" data-edit="${task.id}">Edit</button>
        </div>

        <div class="detail-submeta">
          <div class="detail-row is-full-width"><span>Sender</span><strong>${task.sender ? escHtml(task.sender) : 'N/A'}</strong></div>
          <div class="detail-row is-full-width"><span>Email Subject</span><strong>${task.emailSubject ? escHtml(task.emailSubject) : 'N/A'}</strong></div>
          <div class="detail-row is-date is-created"><span>Created</span><strong>${task.createdAt ? escHtml(formatDate(task.createdAt)) : 'N/A'}</strong></div>
          <div class="detail-row is-date is-received"><span>Received</span><strong>${task.receivedAt ? escHtml(formatDate(task.receivedAt)) : 'N/A'}</strong></div>
          <div class="detail-row is-date is-started"><span>Started</span><strong>${task.startedAt ? escHtml(formatDate(task.startedAt)) : 'N/A'}</strong></div>
          <div class="detail-row is-date is-due ${dueClass}"><span>Due</span><strong>${task.dueDate ? escHtml(formatDate(task.dueDate)) : 'N/A'}</strong></div>
          <div class="detail-row is-date is-completed"><span>Completed</span><strong>${task.completedAt ? escHtml(formatDate(task.completedAt)) : 'N/A'}</strong></div>
        </div>

        <div class="detail-stack">
          <div class="detail-tabs" role="tablist" aria-label="Task detail sections">
            ${detailTabs.map(tab => `
              <button
                type="button"
                class="btn btn-ghost detail-tab-btn ${tab.id === activeDetailTab ? 'is-active' : ''}"
                style="--tab-accent:${tab.accent}"
                data-detail-tab="${tab.id}"
                role="tab"
                id="detail-tab-${tab.id}"
                aria-selected="${tab.id === activeDetailTab ? 'true' : 'false'}"
                aria-controls="detail-panel-${tab.id}"
              >
                <span>${tab.label}</span>
                ${tab.meta ? `<span class="detail-tab-badge">${escHtml(tab.meta)}</span>` : ''}
              </button>`).join('')}
          </div>

          <div class="detail-tab-panels">
            ${detailTabs.map(tab => `
              <section
                class="detail-section ${tab.panelClass} ${tab.id === activeDetailTab ? 'is-active' : ''}"
                id="detail-panel-${tab.id}"
                role="tabpanel"
                aria-labelledby="detail-tab-${tab.id}"
                ${tab.id === activeDetailTab ? '' : 'hidden'}
              >
                ${tab.content}
              </section>`).join('')}
          </div>
        </div>`;

      applyInputLimits();
      applyDetailInlineInputLimits(panel);
      if (activeDetailEditTaskId === task.id && activeDetailEditField) {
        const activeEditor = panel.querySelector(`[data-task-detail-field="${activeDetailEditField}"], [data-detail-edit-input="${activeDetailEditField}"]`);
        if (activeEditor) {
          requestAnimationFrame(() => {
            activeEditor.focus();
            const nextLength = activeEditor.value.length;
            activeEditor.setSelectionRange(nextLength, nextLength);
          });
        }
      }
      if (activeSubtaskEditTaskId === task.id && activeSubtaskEditId) {
        const subtaskEditor = panel.querySelector(`[data-subtask-edit-input="${activeSubtaskEditId}"]`);
        if (subtaskEditor) {
          requestAnimationFrame(() => {
            subtaskEditor.focus();
            const nextLength = subtaskEditor.value.length;
            subtaskEditor.setSelectionRange(nextLength, nextLength);
          });
        }
      }
      restoreScrollTop(panel, preserveScrollTop);
      restoreChildScrollPositions(panel, preservedChildScrolls);
    }

    // ── Escape HTML ──
    // Sanitises any user-supplied string before inserting it into innerHTML.
    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // ── Modal Helpers ──
    // openModal(id) populates the task form for editing an existing task,
    // or resets it to defaults when id is null (new task).
    function openModal(taskId = null) {
      editingId = taskId;
      const modal = document.getElementById('taskModal');
      const form  = document.getElementById('taskForm');
      const title = document.getElementById('modalTitle');
      const subtitle = document.getElementById('taskModalSubtitle');
      const modeBadge = document.getElementById('taskModeBadge');
      const submitLabel = document.getElementById('submitTaskBtnLabel');
      const titleLabel = document.getElementById('taskTitleLabel');
      const titleHelp = document.getElementById('taskTitleHelp');
      const titleField = document.getElementById('taskTitle');

      form.reset();
      renderTaskOptionSets();
      clearTaskDraftImage();

      if (taskId) {
        const t = tasks.find(x => x.id === taskId);
        if (!t) return;
        title.textContent  = 'Edit Task';
        subtitle.textContent = 'Update the task and keep its history intact.';
        modeBadge.textContent = 'Edit mode';
        submitLabel.textContent = 'Save Changes';
        titleLabel.textContent = 'Title *';
        titleHelp.textContent = 'Single task only in edit mode.';
        titleField.placeholder = 'Task title...';
        document.getElementById('taskTitle').value      = t.title;
        document.getElementById('taskTemplate').value   = getTemplateById(t.templateId)?.id || '';
        document.getElementById('taskEmailSubject').value = t.emailSubject || '';
        document.getElementById('taskSender').value = t.sender || '';
        document.getElementById('taskDescription').value = t.description || '';
        document.getElementById('taskProject').value = t.project || '';
        document.getElementById('taskCategory').value   = getCategoryByName(t.category)?.name || categories[0]?.name || '';
        document.getElementById('taskPriority').value   = normalizePriority(t.priority);
        document.getElementById('taskStatus').value     = normalizeStatus(t.status);
        document.getElementById('taskReceivedAt').value = t.receivedAt || '';
        document.getElementById('taskDueDate').value    = t.dueDate    || '';
        document.getElementById('taskStartedAt').value  = t.startedAt  || '';
        document.getElementById('taskCompletedAt').value = t.completedAt || '';
        document.getElementById('taskNotes').value      = t.notes      || '';
        taskDraftImageDataUrl = String(t.imageDataUrl || '').trim();
        taskDraftImageName = String(t.imageName || '').trim();
      } else {
        title.textContent  = 'New Task';
        subtitle.textContent = 'Set shared details once, then create.';
        modeBadge.textContent = 'Create mode';
        submitLabel.textContent = 'Create Task';
        titleLabel.textContent = 'Titles *';
        titleHelp.textContent = 'One line = one task.';
        titleField.placeholder = 'One task title per line to create several tasks at once...';
        document.getElementById('taskTemplate').value   = '';
        document.getElementById('taskEmailSubject').value = '';
        document.getElementById('taskSender').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskProject').value = '';
        document.getElementById('taskCategory').value   = categories[0]?.name || '';
        document.getElementById('taskPriority').value   = DEFAULT_PRIORITY;
        document.getElementById('taskStatus').value     = DEFAULT_STATUS;
        document.getElementById('taskReceivedAt').value = today();
        document.getElementById('taskStartedAt').value  = '';
        document.getElementById('taskCompletedAt').value = '';
      }

      document.getElementById('taskStatus').dataset.lifecycleStatus = normalizeStatus(document.getElementById('taskStatus').value || DEFAULT_STATUS);
      syncTaskLifecycleDraftDates();
      renderTaskProjectOptions();
      updateTaskImagePreview();
      setTaskDatesExpanded(false);
      modal.classList.add('open');
      syncTaskModalFieldAccents();
      document.getElementById('taskTitle').focus();
    }

    function closeModal() {
      document.getElementById('taskModal').classList.remove('open');
      editingId = null;
    }

    function openReportModal() {
      renderReportDashboard();
      document.getElementById('reportModal').classList.add('open');
      document.getElementById('printReportBtn')?.focus();
    }

    function closeReportModal() {
      document.body.classList.remove('report-print-mode');
      document.getElementById('reportModal').classList.remove('open');
    }

    function printReportDashboard() {
      const reportModal = document.getElementById('reportModal');
      if (!reportModal?.classList.contains('open')) return;

      const reportSheet = reportModal.querySelector('.report-modal');
      if (!reportSheet) return;

      const cleanupPrintMode = () => {
        document.body.classList.remove('report-print-mode');
        document.documentElement.style.removeProperty('--report-print-scale');
      };

      document.body.classList.add('report-print-mode');

      window.requestAnimationFrame(() => {
        const targetWidth = 980;
        const targetHeight = 690;
        const measuredWidth = Math.max(reportSheet.scrollWidth, reportSheet.offsetWidth, 1);
        const measuredHeight = Math.max(reportSheet.scrollHeight, reportSheet.offsetHeight, 1);
        const scale = Math.max(.62, Math.min(1, targetWidth / measuredWidth, targetHeight / measuredHeight));

        document.documentElement.style.setProperty('--report-print-scale', scale.toFixed(3));
        window.addEventListener('afterprint', cleanupPrintMode, { once: true });

        window.requestAnimationFrame(() => {
          window.print();
          window.setTimeout(() => {
            cleanupPrintMode();
          }, 1200);
        });
      });
    }

    function setTaskDatesExpanded(expanded) {
      const toggleButton = document.getElementById('taskDatesToggleBtn');
      const dateGroup = document.getElementById('taskDatesGroup');
      if (!toggleButton || !dateGroup) return;

      const nextExpanded = expanded === true;
      dateGroup.hidden = !nextExpanded;
      toggleButton.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
      toggleButton.textContent = nextExpanded ? 'Hide Dates' : 'Show Dates';
    }

    function bindBackdropDismiss(backdropId, closeHandler) {
      const backdrop = document.getElementById(backdropId);
      if (!backdrop || typeof closeHandler !== 'function') return;

      let startedOnBackdrop = false;

      backdrop.addEventListener('pointerdown', event => {
        startedOnBackdrop = event.target === backdrop;
      });

      backdrop.addEventListener('pointercancel', () => {
        startedOnBackdrop = false;
      });

      backdrop.addEventListener('click', event => {
        const clickedBackdrop = event.target === backdrop;
        const shouldClose = clickedBackdrop && startedOnBackdrop;
        startedOnBackdrop = false;
        if (shouldClose) {
          closeHandler();
        }
      });
    }

    function moveCategory(categoryName, direction) {
      if (isProtectedCategory(categoryName)) return false;

      const currentIndex = categories.findIndex(category => category.name === categoryName);
      if (currentIndex === -1) return false;

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 1 || nextIndex >= categories.length) return false;

      [categories[currentIndex], categories[nextIndex]] = [categories[nextIndex], categories[currentIndex]];
      return true;
    }

    // ── Form Submit ──
    // Handles both create and edit: updates the in-memory tasks array,
    // persists via the active storage backend, and re-renders.
