// Keep the detail panel delegated on its root so inline editing, subtasks,
// logs, items, and the context menu preserve the original interaction flow.
document.getElementById("taskDetailPanel").addEventListener("click", (e) => {
  const editId = e.target.closest("[data-edit]")?.dataset.edit;
  const editDetailField = e.target.closest("[data-edit-detail-field]")?.dataset
    .editDetailField;
  const cancelDetailEditField = e.target.closest("[data-cancel-detail-edit]")
    ?.dataset.cancelDetailEdit;
  const detailTabId = e.target.closest("[data-detail-tab]")?.dataset.detailTab;
  const editLogDateId = e.target.closest("[data-edit-log-date]")?.dataset
    .editLogDate;
  const cancelLogDateEditId = e.target.closest("[data-cancel-log-date-edit]")
    ?.dataset.cancelLogDateEdit;
  const deleteLogId = e.target.closest("[data-delete-log]")?.dataset.deleteLog;
  const toggleSubtaskId = e.target.closest("[data-toggle-subtask]")?.dataset
    .toggleSubtask;
  const editSubtaskId = e.target.closest("[data-edit-subtask]")?.dataset
    .editSubtask;
  const cancelSubtaskEditId = e.target.closest("[data-cancel-subtask-edit]")
    ?.dataset.cancelSubtaskEdit;
  const subtaskBatchAction = e.target.closest("[data-subtask-batch]")?.dataset
    .subtaskBatch;
  const deleteSubtaskId = e.target.closest("[data-delete-subtask]")?.dataset
    .deleteSubtask;
  const moveSubtaskId = e.target.closest("[data-move-subtask]")?.dataset
    .moveSubtask;
  const moveDirection = e.target.closest("[data-move-direction]")?.dataset
    .moveDirection;
  const deleteItemId =
    e.target.closest("[data-delete-item]")?.dataset.deleteItem;

  if (detailTabId) {
    activeDetailEditField = null;
    activeDetailEditTaskId = null;
    activeLogDateEditId = null;
    clearActiveSubtaskEdit();
    activeDetailTab = detailTabId;
    renderTaskDetails();
    return;
  }

  if (editLogDateId) {
    activeLogDateEditId = editLogDateId;
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (cancelLogDateEditId) {
    activeLogDateEditId = null;
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (cancelDetailEditField) {
    if (activeDetailEditField === cancelDetailEditField) {
      activeDetailEditField = null;
      activeDetailEditTaskId = null;
    }
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (editDetailField) {
    clearActiveSubtaskEdit();
    activeDetailEditField = editDetailField;
    activeDetailEditTaskId = selectedTaskId;
    renderTaskDetails(true);
    return;
  }

  if (editId) {
    clearActiveSubtaskEdit();
    openModal(editId);
    return;
  }

  if (editSubtaskId) {
    activeDetailEditField = null;
    activeDetailEditTaskId = null;
    activeSubtaskEditTaskId = selectedTaskId;
    activeSubtaskEditId = editSubtaskId;
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (cancelSubtaskEditId) {
    clearActiveSubtaskEdit();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (subtaskBatchAction) {
    const task = getTaskById(selectedTaskId);
    if (!task) return;

    const didUpdate = {
      "complete-all": () => setAllSubtasksDone(task, true),
      "reopen-all": () => setAllSubtasksDone(task, false),
      "clear-completed": () => clearCompletedSubtasks(task),
    }[subtaskBatchAction]?.();

    if (!didUpdate) return;
    clearActiveSubtaskEdit();
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (deleteSubtaskId) {
    const task = getTaskById(selectedTaskId);
    if (!task) return;
    if (!confirm("Delete this subtask?")) return;
    task.subtasks = (task.subtasks || []).filter(
      (subtask) => subtask.id !== deleteSubtaskId,
    );
    if (activeSubtaskEditId === deleteSubtaskId) {
      clearActiveSubtaskEdit();
    }
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (toggleSubtaskId) {
    const task = getTaskById(selectedTaskId);
    if (!task) return;
    task.subtasks = (task.subtasks || []).map((subtask) =>
      subtask.id === toggleSubtaskId
        ? { ...subtask, done: !subtask.done }
        : subtask,
    );
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (moveSubtaskId) {
    const task = getTaskById(selectedTaskId);
    if (!task || !moveDirection) return;
    if (!moveSubtask(task, moveSubtaskId, moveDirection)) return;
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (deleteItemId) {
    if (!confirm("Delete this item?")) return;
    items = items.filter((item) => item.id !== deleteItemId);
    selectedItemIds.delete(deleteItemId);
    activeDetailTab = "items";
    saveItems();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  const clearItemImageId = e.target.closest("[data-clear-item-image]")?.dataset
    .clearItemImage;
  if (clearItemImageId) {
    if (!clearItemImage(clearItemImageId)) return;
    activeDetailTab = "items";
    saveItems();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (deleteLogId) {
    if (confirm("Delete this log entry?")) {
      if (activeLogDateEditId === deleteLogId) {
        activeLogDateEditId = null;
      }
      logs = logs.filter((log) => log.id !== deleteLogId);
      saveLogs();
      renderTasks({
        preserveDetailScroll: true,
        preserveItemsModalScroll: true,
      });
    }
  }

  const openImport = e.target.closest("[data-open-item-import]");
  if (openImport) {
    document.getElementById("workflowItemImportInput")?.click();
  }
});

document.getElementById("taskDetailPanel").addEventListener("change", (e) => {
  const detailField = e.target.closest("[data-task-detail-field]");
  const field = e.target.closest("[data-item-field]");
  const imageField = e.target.closest("[data-item-image-upload]");
  const importField =
    e.target.id === "workflowItemImportInput" ? e.target : null;

  if (!detailField && !field && !imageField && !importField) return;

  if (detailField) {
    const task = getTaskById(selectedTaskId);
    const fieldName = detailField.dataset.taskDetailField;
    if (!task || !fieldName) return;

    const limit = getDetailInlineFieldLimit(fieldName);
    if (limit && detailField.value.length > limit) {
      detailField.value = detailField.value.slice(0, limit);
      syncInputCounterForField(detailField, `detail-${fieldName}`, limit);
    }

    if (fieldName === "progressPercent") {
      task.progressPercent = isTaskCompleted(task)
        ? 100
        : normalizeTaskProgressPercent(detailField.value);
      detailField.value = String(task.progressPercent);
    } else {
      task[fieldName] = String(detailField.value || "").trim() || null;
    }
    activeDetailEditField = null;
    activeDetailEditTaskId = null;
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (importField) {
    importItemsFromWorkbook(importField.files?.[0], selectedTaskId)
      .then((result) => {
        importField.value = "";
        if (!result) return;
        activeDetailTab = "items";
        saveItems();
        renderTasks({
          preserveDetailScroll: true,
          preserveItemsModalScroll: true,
        });
        alert(result.message);
      })
      .catch((error) => {
        importField.value = "";
        alert(error.message || "Unable to import the workbook.");
      });
    return;
  }

  if (imageField) {
    applyItemImageChange(
      imageField.dataset.itemImageUpload,
      imageField.files?.[0],
    )
      .then((result) => {
        if (!result.ok && result.message) {
          alert(result.message);
          return;
        }

        activeDetailTab = "items";
        saveItems();
        renderTasks({
          preserveDetailScroll: true,
          preserveItemsModalScroll: true,
        });
      })
      .catch((error) =>
        alert(error.message || "Unable to save the item image."),
      );
    return;
  }

  if (field) {
    const result = applyItemFieldChange(
      field.dataset.itemId,
      field.dataset.itemField,
      field.type === "checkbox" ? field.checked : field.value,
    );
    if (!result.ok && result.message) {
      alert(result.message);
    }
  }

  activeDetailTab = "items";
  saveItems();
  renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
});

document.getElementById("taskDetailPanel").addEventListener("input", (e) => {
  const detailField = e.target.closest("[data-task-detail-field]");
  if (!detailField) return;

  const task = getTaskById(selectedTaskId);
  const fieldName = detailField.dataset.taskDetailField;
  if (!task || !fieldName) return;

  const limit = getDetailInlineFieldLimit(fieldName);
  if (limit && detailField.value.length > limit) {
    detailField.value = detailField.value.slice(0, limit);
    syncInputCounterForField(detailField, `detail-${fieldName}`, limit);
  }

  if (fieldName === "progressPercent") {
    task.progressPercent = isTaskCompleted(task)
      ? 100
      : normalizeTaskProgressPercent(detailField.value);
  } else {
    task[fieldName] = detailField.value;
  }
  saveTasks();
});

document.getElementById("detailContextMenu").addEventListener("click", (e) => {
  const action = e.target.closest("[data-context-action]")?.dataset
    .contextAction;
  if (!action) return;

  const task = getTaskById(selectedTaskId);
  closeDetailContextMenu();
  if (!task) return;

  if (action === "edit") {
    openModal(task.id);
    return;
  }

  if (action === "toggle-status") {
    applyTaskStatusChange(
      task,
      isTaskCompleted(task) ? DEFAULT_STATUS : "Completed",
    );
    saveTasks();
    renderTasks();
    return;
  }

  if (action === "duplicate") {
    const duplicatedTask = {
      ...task,
      id: genId(),
      title: `${task.title} (Copy)`,
      status: DEFAULT_STATUS,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      subtasks: (task.subtasks || []).map((subtask) => ({
        ...subtask,
        id: genId(),
        done: false,
      })),
    };
    delete duplicatedTask.workflowItems;
    tasks.unshift(duplicatedTask);
    selectedTaskId = duplicatedTask.id;
    saveTasks();
    renderTasks();
    return;
  }

  if (action === "delete") {
    if (!confirm("Delete this task?")) return;
    deleteTasksAndLinkedData([task.id]);
    saveTasks();
    saveLogs();
    saveItems();
    renderTasks();
  }
});

document.getElementById("taskDetailPanel").addEventListener("submit", (e) => {
  const detailEditFormField = e.target.dataset.detailEditForm;
  if (detailEditFormField) {
    e.preventDefault();
    const task = getTaskById(selectedTaskId);
    const input = e.target.querySelector(
      `[data-detail-edit-input="${detailEditFormField}"]`,
    );
    if (!task || !input) return;

    const limit = getDetailInlineFieldLimit(detailEditFormField);
    let nextValue = String(input.value || "");
    if (limit && nextValue.length > limit) {
      nextValue = nextValue.slice(0, limit);
      input.value = nextValue;
      syncInputCounterForField(input, `detail-${detailEditFormField}`, limit);
    }

    task[detailEditFormField] = nextValue.trim() || null;
    activeDetailEditField = null;
    activeDetailEditTaskId = null;
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  const logDateFormId = e.target.dataset.logDateForm;
  if (logDateFormId) {
    e.preventDefault();
    const log = getLogById(logDateFormId);
    const dateInput = e.target.querySelector(
      `[data-log-date-input="${logDateFormId}"]`,
    );
    const contentInput = e.target.querySelector(
      `[data-log-content-input="${logDateFormId}"]`,
    );
    const nextCreatedAt = parseDateTimeLocalValue(dateInput?.value);
    const nextContent = String(contentInput?.value || "").trim();

    if (!log || !dateInput || !nextCreatedAt) {
      dateInput?.focus();
      return;
    }

    if (!contentInput || !nextContent) {
      contentInput?.focus();
      return;
    }

    log.createdAt = nextCreatedAt;
    log.content = nextContent;
    activeLogDateEditId = null;
    saveLogs();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (e.target.id === "subtaskForm") {
    e.preventDefault();
    const subtaskField = document.getElementById("subtaskTitle");
    const subtaskTitles = parseSubtaskLines(subtaskField.value).map((title) =>
      normalizeSingleLineText(title),
    );
    const task = getTaskById(selectedTaskId);

    if (!subtaskTitles.length || !task) {
      subtaskField?.focus();
      return;
    }

    task.subtasks = [
      ...(task.subtasks || []),
      ...subtaskTitles.map((title) => ({ id: genId(), title, done: false })),
    ];
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    document.getElementById("subtaskTitle")?.focus();
    return;
  }

  const subtaskEditId = e.target.dataset.subtaskEditForm;
  if (subtaskEditId) {
    e.preventDefault();
    const task = getTaskById(selectedTaskId);
    const subtaskField = e.target.querySelector(
      `[data-subtask-edit-input="${subtaskEditId}"]`,
    );
    if (!task || !subtaskField) return;

    if (!updateSubtaskTitle(task, subtaskEditId, subtaskField.value)) {
      subtaskField.focus();
      return;
    }

    clearActiveSubtaskEdit();
    saveTasks();
    renderTasks({ preserveDetailScroll: true, preserveItemsModalScroll: true });
    return;
  }

  if (e.target.id === "workflowItemForm") {
    e.preventDefault();

    const task = getTaskById(selectedTaskId);
    const bidField = document.getElementById("workflowItemBidInput");
    const tidField = document.getElementById("workflowItemTidInput");
    const statusField = document.getElementById("workflowItemStatusInput");
    const supplierField = document.getElementById("workflowItemSupplierInput");
    const imageField = document.getElementById("workflowItemImageInput");
    if (
      !task ||
      !bidField ||
      !tidField ||
      !statusField ||
      !supplierField ||
      !imageField
    )
      return;

    const bid = normalizeUniqueReference(bidField.value);
    const tid = normalizeUniqueReference(tidField.value);
    if (!bid && !tid) {
      bidField.focus();
      return;
    }

    Promise.resolve(
      imageField.files?.[0] ? buildItemImageData(imageField.files[0]) : "",
    )
      .then((imageDataUrl) => {
        const nextItem = createTaskItem(
          {
            bid,
            tid,
            status: statusField.value,
            supplier: supplierField.value,
            imageDataUrl,
            imageName: imageField.files?.[0]?.name || "",
          },
          task,
        );

        if (!nextItem) {
          bidField.focus();
          return;
        }

        items = [nextItem, ...items];
        activeDetailTab = "items";
        saveItems();
        renderTasks({
          preserveDetailScroll: true,
          preserveItemsModalScroll: true,
        });
      })
      .catch((error) =>
        alert(error.message || "Unable to save the item image."),
      );
    return;
  }

  if (e.target.id !== "logForm") return;
  e.preventDefault();

  const contentField = document.getElementById("logContent");
  const content = contentField.value.trim();
  if (!content || !selectedTaskId) {
    contentField?.focus();
    return;
  }

  logs.unshift({
    id: genId(),
    taskId: selectedTaskId,
    content,
    createdAt: new Date().toISOString(),
  });

  saveLogs();
  renderTasks();
  document.getElementById("logContent")?.focus();
});
