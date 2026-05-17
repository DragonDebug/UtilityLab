    document.getElementById('categoryForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = normalizeCategoryName(document.getElementById('categoryName').value);
      const color = document.getElementById('categoryColor').value;

      if (!name) {
        document.getElementById('categoryName').focus();
        return;
      }

      if (editingCategoryName && isProtectedCategory(editingCategoryName) && name !== 'General') {
        document.getElementById('categoryName').value = 'General';
        document.getElementById('categoryName').focus();
        return;
      }

      const duplicate = categories.find(category => category.name.toLowerCase() === name.toLowerCase() && category.name !== editingCategoryName);
      if (duplicate) {
        document.getElementById('categoryName').focus();
        return;
      }

      if (editingCategoryName) {
        categories = categories.map(category => {
          if (category.name !== editingCategoryName) return category;
          return { name, color };
        });
        tasks = tasks.map(task => task.category === editingCategoryName ? { ...task, category: name } : task);
        hiddenFilters = {
          ...hiddenFilters,
          category: normalizeHiddenFilterValues(
            'category',
            (hiddenFilters.category || []).map(categoryName => categoryName === editingCategoryName ? name : categoryName)
          )
        };
      } else {
        categories.push({ name, color });
      }

      editingCategoryName = null;
      document.getElementById('submitCategoryBtn').textContent = 'Save Category';
      document.getElementById('categoryForm').reset();
      document.getElementById('categoryColor').value = '#5b8def';
      syncCategoryColorPresets('#5b8def');
      saveCategories();
      saveTasks();
      saveHiddenFilters();
      renderCategoryList();
      renderTasks();
    });

    document.getElementById('categoryForm').addEventListener('click', e => {
      const presetButton = e.target.closest('[data-category-color]');
      if (!presetButton) return;

      const colorField = document.getElementById('categoryColor');
      colorField.value = presetButton.dataset.categoryColor;
      syncCategoryColorPresets(colorField.value);
    });

    document.getElementById('categoryColor').addEventListener('input', e => {
      syncCategoryColorPresets(e.target.value);
    });

    document.getElementById('templateForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = normalizeCategoryName(document.getElementById('templateName').value);
      const subtasks = parseSubtaskLines(document.getElementById('templateSubtasks').value);

      if (!name) {
        document.getElementById('templateName').focus();
        return;
      }

      const duplicate = templates.find(template => template.name.toLowerCase() === name.toLowerCase() && template.id !== editingTemplateId);
      if (duplicate) {
        document.getElementById('templateName').focus();
        return;
      }

      if (editingTemplateId) {
        templates = templates.map(template => template.id === editingTemplateId ? { ...template, name, subtasks } : template);
      } else {
        templates.unshift({ id: genId(), name, subtasks });
      }

      editingTemplateId = null;
      document.getElementById('templateForm').reset();
      document.getElementById('submitTemplateBtn').textContent = 'Save Template';
      saveTemplates();
      renderTemplateList();
      renderTasks();
    });

    function applyItemSettingsForm(options = {}) {
      const closeModalAfterSave = options.closeModalAfterSave !== false;
      const senderOptions = normalizeOptionList(document.getElementById('taskSenderOptionsInput').value);
      const projectOptions = normalizeOptionList(document.getElementById('taskProjectOptionsInput').value);
      const supplierOptions = normalizeOptionList(document.getElementById('itemSupplierOptionsInput').value);
      const detailedExportWeekYear = clampWorkingWeekYear(document.getElementById('detailedExportWeekYearInput').value);
      const detailedExportWeekNumber = clampWorkingWeekNumber(document.getElementById('detailedExportWeekNumberInput').value, detailedExportWeekYear);
      const detailedExportColumnOrder = Array.from(document.querySelectorAll('#detailedExportColumnsList [data-export-column-key]'))
        .map(row => row.dataset.exportColumnKey || '')
        .filter(Boolean);
      const detailedExportVisibleColumns = Array.from(document.querySelectorAll('#detailedExportColumnsList [data-export-column-visible]:checked'))
        .map(input => input.dataset.exportColumnVisible || '')
        .filter(Boolean);
      const detailedExportCounters = {
        summaryVisibility: {},
        categoryVisibility: {}
      };
      Array.from(document.querySelectorAll('#detailedExportCountersList [data-export-counter-key]')).forEach(input => {
        const counterKey = input.dataset.exportCounterKey || '';
        if (!counterKey) return;

        if (DETAILED_EXPORT_COUNTER_SUMMARY_KEYS.includes(counterKey)) {
          detailedExportCounters.summaryVisibility[counterKey] = input.checked;
          return;
        }

        detailedExportCounters.categoryVisibility[counterKey] = input.checked;
      });
      const taskCardImageSize = document.getElementById('taskCardImageSizeInput').value;
      const completedTaskVisibilityMode = normalizeCompletedTaskVisibilityMode(document.getElementById('completedTaskVisibilityModeInput').value);
      const completedTaskVisibleDays = normalizePositiveInteger(document.getElementById('completedTaskVisibleDaysInput').value, 30, 1, 3650);
      const completedTaskCleanupDays = normalizePositiveInteger(document.getElementById('completedTaskCleanupDaysInput').value, completedTaskVisibleDays, 1, 3650);
      const completedTaskCleanupBeforeYear = normalizePositiveInteger(document.getElementById('completedTaskCleanupBeforeYearInput').value, new Date().getFullYear(), 2000, 9999);

      if (!supplierOptions.length) {
        document.getElementById('itemSupplierOptionsInput').focus();
        return false;
      }

      itemSettings = normalizeItemSettings({
        senderOptions,
        projectOptions,
        supplierOptions,
        detailedExportWeekNumber,
        detailedExportWeekYear,
        detailedExportColumns: {
          order: detailedExportColumnOrder,
          visible: detailedExportVisibleColumns
        },
        detailedExportCounters,
        taskCardImageSize,
        completedTaskVisibilityMode,
        completedTaskVisibleDays,
        completedTaskCleanupDays,
        completedTaskCleanupBeforeYear
      });
      saveItemSettings();
      applyTaskCardImageSizePreference();
      renderTaskProjectOptions();
      if (closeModalAfterSave) {
        closeItemSettingsModal();
      } else {
        fillItemSettingsForm();
      }
      renderTasks();
      renderAllItemsList();
      updateStorageStatusCard();
      return true;
    }

    document.getElementById('itemSettingsForm').addEventListener('submit', e => {
      e.preventDefault();
      applyItemSettingsForm();
    });

    document.getElementById('itemSettingsForm').addEventListener('click', e => {
      const moveButton = e.target.closest('[data-export-column-move]');
      if (!moveButton) return;

      const direction = moveButton.dataset.exportColumnMove;
      const row = moveButton.closest('[data-export-column-key]');
      const list = row?.parentElement;
      if (!row || !list || !direction) return;

      if (direction === 'up' && row.previousElementSibling) {
        list.insertBefore(row, row.previousElementSibling);
      }

      if (direction === 'down' && row.nextElementSibling) {
        list.insertBefore(row.nextElementSibling, row);
      }

      const reorderedSettings = {
        ...itemSettings,
        detailedExportColumns: {
          order: Array.from(list.querySelectorAll('[data-export-column-key]')).map(item => item.dataset.exportColumnKey || '').filter(Boolean),
          visible: Array.from(list.querySelectorAll('[data-export-column-visible]:checked')).map(input => input.dataset.exportColumnVisible || '').filter(Boolean)
        }
      };

      renderDetailedExportColumnSettings(reorderedSettings);
    });

    document.getElementById('exportBackupBtn').addEventListener('click', exportBackupToJson);
    document.getElementById('exportDetailedExcelFromSettingsBtn').addEventListener('click', () => {
      if (!applyItemSettingsForm({ closeModalAfterSave: false })) return;
      exportDetailedToExcel();
    });
    document.getElementById('importBackupBtn').addEventListener('click', () => {
      document.getElementById('settingsBackupInput')?.click();
    });
    document.getElementById('detailedExportWeekNumberInput').addEventListener('input', updateDetailedExportWeekPreview);
    document.getElementById('detailedExportWeekYearInput').addEventListener('input', updateDetailedExportWeekPreview);
    document.getElementById('settingsBackupInput').addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await importBackupFromFile(file);
      } catch (error) {
        alert(error?.message || 'Unable to import that backup file.');
      } finally {
        e.target.value = '';
      }
    });
    document.getElementById('clearAllDataBtn').addEventListener('click', async () => {
      try {
        await removeAllTaskManagerData();
      } catch (error) {
        notifyStorageError('Unable to remove all Task Manager data.', error);
        alert(error?.message || 'Unable to remove all Task Manager data from this browser.');
      }
    });

    // ── Modal Open/Close ──
    // Wire up remaining modal actions and backdrop clicks here until the rest
    // of the modal workflow is extracted.
    document.getElementById('clearCompletedBtn').addEventListener('click', () => {
      const completedCount = tasks.filter(task => isTaskCompleted(task)).length;
      if (!completedCount) {
        alert('There are no completed tasks to clean up right now.');
        return;
      }

      const cleanupChoice = prompt(
        `Clear Done options:\n1 = Delete all completed tasks\n2 = Delete completed tasks older than ${getCompletedTaskCleanupDays()} days\n3 = Delete completed tasks completed before year ${getCompletedTaskCleanupBeforeYear()}\n\nEnter 1, 2, or 3.`,
        '2'
      );
      if (cleanupChoice === null) return;

      const normalizedChoice = cleanupChoice.trim();
      let cleanupCriteria = { mode: 'all' };
      let cleanupRuleLabel = 'All completed tasks';

      if (normalizedChoice === '2') {
        const daysInput = prompt('Delete completed tasks older than how many days?', String(getCompletedTaskCleanupDays()));
        if (daysInput === null) return;

        const days = normalizePositiveInteger(daysInput, null, 1, 3650);
        if (!Number.isInteger(days)) {
          alert('Enter a valid number of days.');
          return;
        }

        cleanupCriteria = { mode: 'older-than-days', days };
        cleanupRuleLabel = `Completed tasks older than ${days} day${days === 1 ? '' : 's'}`;
      } else if (normalizedChoice === '3') {
        const yearInput = prompt('Delete completed tasks completed before which year?', String(getCompletedTaskCleanupBeforeYear()));
        if (yearInput === null) return;

        const year = normalizePositiveInteger(yearInput, null, 2000, 9999);
        if (!Number.isInteger(year)) {
          alert('Enter a valid year.');
          return;
        }

        cleanupCriteria = { mode: 'before-year', year };
        cleanupRuleLabel = `Completed tasks finished before ${year}`;
      } else if (normalizedChoice !== '1') {
        alert('Enter 1, 2, or 3 to choose a cleanup option.');
        return;
      }

      const tasksToDelete = getCompletedTasksForCleanup(cleanupCriteria);
      if (!tasksToDelete.length) {
        alert(`No matching tasks were found for this rule: ${cleanupRuleLabel}.`);
        return;
      }

      const taskCount = tasksToDelete.length;
      if (confirm(`Permanently delete ${taskCount} matching completed task${taskCount === 1 ? '' : 's'} plus their logs and linked items?\n\nRule: ${cleanupRuleLabel}.`)) {
        clearCompletedTasks(cleanupCriteria);
      }
    });
    document.getElementById('categoryList').addEventListener('click', e => {
      const moveName = e.target.closest('[data-move-category]')?.dataset.moveCategory;
      const moveDirection = e.target.closest('[data-move-direction]')?.dataset.moveDirection;
      const editName = e.target.closest('[data-edit-category]')?.dataset.editCategory;
      const deleteName = e.target.closest('[data-delete-category]')?.dataset.deleteCategory;

      if (moveName) {
        if (!moveDirection) return;
        if (!moveCategory(moveName, moveDirection)) return;
        saveCategories();
        renderCategoryList();
        renderTasks();
        return;
      }

      if (editName) {
        const category = getCategoryByName(editName);
        if (!category) return;
        editingCategoryName = category.name;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('categoryColor').value = category.color;
        syncCategoryColorPresets(category.color);
        document.getElementById('submitCategoryBtn').textContent = 'Update Category';
        document.getElementById('categoryName').disabled = isProtectedCategory(category.name);
        document.getElementById('categoryName').focus();
        return;
      }

      if (deleteName) {
        if (isProtectedCategory(deleteName)) return;
        if (confirm(`Delete category "${deleteName}"? Tasks in it will move to General.`)) {
          categories = categories.filter(category => category.name !== deleteName);
          tasks = tasks.map(task => task.category === deleteName ? { ...task, category: 'General' } : task);
          hiddenFilters = {
            ...hiddenFilters,
            category: (hiddenFilters.category || []).filter(categoryName => categoryName !== deleteName)
          };
          if (document.getElementById('filterCategory').value === deleteName) {
            document.getElementById('filterCategory').value = '';
          }
          saveCategories();
          saveTasks();
          saveHiddenFilters();
          renderCategoryList();
          renderTasks();
        }
      }
    });

    document.getElementById('templateList').addEventListener('click', e => {
      const editTemplateId = e.target.closest('[data-edit-template]')?.dataset.editTemplate;
      const deleteTemplateId = e.target.closest('[data-delete-template]')?.dataset.deleteTemplate;

      if (editTemplateId) {
        const template = getTemplateById(editTemplateId);
        if (!template) return;
        editingTemplateId = template.id;
        document.getElementById('templateName').value = template.name;
        document.getElementById('templateSubtasks').value = template.subtasks.join('\n');
        document.getElementById('submitTemplateBtn').textContent = 'Update Template';
        document.getElementById('templateName').focus();
        return;
      }

      if (deleteTemplateId) {
        const template = getTemplateById(deleteTemplateId);
        if (!template) return;
        if (confirm(`Delete template "${template.name}"? Existing tasks will keep their current subtasks.`)) {
          templates = templates.filter(item => item.id !== deleteTemplateId);
          saveTemplates();
          renderTemplateList();
          renderTasks();
        }
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeDetailContextMenu();
        closeModal();
        closeCategoryModal();
        closeTemplateModal();
        closeItemsModal();
        closeReportModal();
      }
    });

    document.addEventListener('click', e => {
      if (e.target.closest('#detailContextMenu')) return;
      closeDetailContextMenu();
    });

    window.addEventListener('resize', closeDetailContextMenu);
    document.addEventListener('scroll', closeDetailContextMenu, true);

    function fillItemSettingsForm() {
      document.getElementById('taskSenderOptionsInput').value = (itemSettings?.senderOptions || []).join('\n');
      document.getElementById('taskProjectOptionsInput').value = (itemSettings?.projectOptions || []).join('\n');
      document.getElementById('itemSupplierOptionsInput').value = (itemSettings?.supplierOptions || DEFAULT_ITEM_SUPPLIER_OPTIONS).join('\n');
      document.getElementById('taskCardImageSizeInput').value = itemSettings?.taskCardImageSize || 'large';
      document.getElementById('completedTaskVisibilityModeInput').value = getCompletedTaskVisibilityMode();
      document.getElementById('completedTaskVisibleDaysInput').value = getCompletedTaskVisibleDays();
      document.getElementById('completedTaskCleanupDaysInput').value = getCompletedTaskCleanupDays();
      document.getElementById('completedTaskCleanupBeforeYearInput').value = getCompletedTaskCleanupBeforeYear();
      const detailedExportWeekSelection = getDetailedExportWeekSelection();
      document.getElementById('detailedExportWeekNumberInput').value = detailedExportWeekSelection.weekNumber;
      document.getElementById('detailedExportWeekYearInput').value = detailedExportWeekSelection.year;
      renderDetailedExportColumnSettings();
      renderDetailedExportCounterSettings();
      updateDetailedExportWeekPreview();
    }

    function renderDetailedExportColumnSettings(settings = itemSettings) {
      const list = document.getElementById('detailedExportColumnsList');
      if (!list) return;

      const normalizedSettings = normalizeDetailedExportColumnSettings(settings?.detailedExportColumns);
      const visibleKeySet = new Set(normalizedSettings.visible);

      list.innerHTML = normalizedSettings.order.map((columnKey, index) => {
        const column = getDetailedExportColumnDefinition(columnKey);
        if (!column) return '';

        return `
          <div class="item-settings-config-row" data-export-column-key="${escHtml(column.key)}">
            <label class="item-settings-config-check">
              <input type="checkbox" data-export-column-visible="${escHtml(column.key)}" ${visibleKeySet.has(column.key) ? 'checked' : ''} />
              <span class="item-settings-config-copy">
                <strong>${escHtml(column.label)}</strong>
                <span>${column.isDate ? 'Date field in the workbook.' : (column.isImage ? 'Task image column in the workbook.' : 'Shared workbook column.')}</span>
              </span>
            </label>
            <div class="item-settings-order-actions">
              <button type="button" class="btn btn-ghost item-settings-order-btn" data-export-column-move="up" ${index === 0 ? 'disabled' : ''} aria-label="Move column up" title="Move up">↑</button>
              <button type="button" class="btn btn-ghost item-settings-order-btn" data-export-column-move="down" ${index === normalizedSettings.order.length - 1 ? 'disabled' : ''} aria-label="Move column down" title="Move down">↓</button>
            </div>
          </div>`;
      }).join('');
    }

    function renderDetailedExportCounterSettings(settings = itemSettings) {
      const list = document.getElementById('detailedExportCountersList');
      if (!list) return;

      const visibleKeySet = new Set(getConfiguredDetailedExportCounterKeys(settings));
      const counterOptions = getDetailedExportCounterOptions();

      list.innerHTML = counterOptions.map(counter => `
        <label class="item-settings-config-row item-settings-config-check">
          <input type="checkbox" data-export-counter-key="${escHtml(counter.key)}" ${visibleKeySet.has(counter.key) ? 'checked' : ''} />
          <span class="item-settings-config-copy">
            <strong>${escHtml(counter.label)}</strong>
            <span>${counter.categoryName ? 'Category total on the Counters sheet.' : 'Summary counter on the Counters sheet.'}</span>
          </span>
        </label>`).join('');
    }

    function updateDetailedExportWeekPreview() {
      const preview = document.getElementById('detailedExportWeekPreview');
      const weekNumberInput = document.getElementById('detailedExportWeekNumberInput');
      const weekYearInput = document.getElementById('detailedExportWeekYearInput');
      if (!preview || !weekNumberInput || !weekYearInput) return;

      const fallbackSelection = getDetailedExportWeekSelection();
      const year = clampWorkingWeekYear(weekYearInput.value || fallbackSelection.year);
      const maxWeeks = getWorkingWeeksInYear(year);
      const weekNumber = clampWorkingWeekNumber(weekNumberInput.value || fallbackSelection.weekNumber, year);
      const weekInfo = getWorkingWeekInfoByNumber(year, weekNumber);

      weekNumberInput.max = String(maxWeeks);
      preview.textContent = `${weekInfo.label} (${year}) runs ${formatWeekRangeLabel(weekInfo)}. Weekly Completed includes Sunday to Thursday only.`;
    }

    function openItemSettingsModal() {
      fillItemSettingsForm();
      updateStorageStatusCard();
      document.getElementById('itemSettingsModal').classList.add('open');
      document.getElementById('taskSenderOptionsInput').focus();
    }

    function closeItemSettingsModal() {
      document.getElementById('itemSettingsModal').classList.remove('open');
      fillItemSettingsForm();
    }

    function openCategoryModal() {
      document.getElementById('categoryModal').classList.add('open');
      renderCategoryList();
      syncCategoryColorPresets(document.getElementById('categoryColor').value || '#5b8def');
      document.getElementById('categoryName').focus();
    }

    function closeCategoryModal() {
      document.getElementById('categoryModal').classList.remove('open');
      editingCategoryName = null;
      document.getElementById('categoryForm').reset();
      document.getElementById('categoryName').disabled = false;
      document.getElementById('categoryColor').value = '#5b8def';
      syncCategoryColorPresets('#5b8def');
      document.getElementById('submitCategoryBtn').textContent = 'Save Category';
    }

    function openTemplateModal() {
      document.getElementById('templateModal').classList.add('open');
      renderTemplateList();
      document.getElementById('templateName').focus();
    }

    function closeTemplateModal() {
      document.getElementById('templateModal').classList.remove('open');
      editingTemplateId = null;
      document.getElementById('templateForm').reset();
      document.getElementById('submitTemplateBtn').textContent = 'Save Template';
    }

