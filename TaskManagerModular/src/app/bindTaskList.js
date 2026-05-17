// Keep task-list interaction delegated on the list root so card, table, and
// inline-control behavior stays aligned with the original single-file app.
document.getElementById("taskList").addEventListener("click", (e) => {
  const tableSortColumn =
    e.target.closest("[data-table-sort]")?.dataset.tableSort;
  const editId = e.target.closest("[data-edit]")?.dataset.edit;
  const deleteId = e.target.closest("[data-delete]")?.dataset.delete;
  const completeId = e.target.closest("[data-toggle-complete]")?.dataset
    .toggleComplete;
  const favoriteId = e.target.closest("[data-toggle-favorite]")?.dataset
    .toggleFavorite;

  if (tableSortColumn) {
    toggleTaskTableSort(tableSortColumn);
    renderTasks({ recomputeOrder: true });
    return;
  }

  if (favoriteId) {
    const task = tasks.find((item) => item.id === favoriteId);
    if (!task) return;
    task.isFavorite = !isTaskFavorite(task);
    saveTasks();
    renderTasks({
      recomputeOrder: true,
      preserveDetailScroll: true,
      preserveItemsModalScroll: true,
    });
    return;
  }

  if (completeId) {
    const task = tasks.find((item) => item.id === completeId);
    if (!task) return;
    applyTaskStatusChange(
      task,
      isTaskCompleted(task) ? DEFAULT_STATUS : "Completed",
    );
    saveTasks();
    renderTasks({
      preserveOrder: true,
      preserveDetailScroll: true,
      preserveItemsModalScroll: true,
    });
    return;
  }

  if (editId) {
    openModal(editId);
    return;
  }

  if (deleteId) {
    if (confirm("Delete this task?")) {
      deleteTasksAndLinkedData([deleteId]);
      saveTasks();
      saveLogs();
      saveItems();
      renderTasks();
    }
    return;
  }

  const taskRow = e.target.closest("[data-task-row], .task-card");
  const taskId = taskRow?.dataset.taskRow || taskRow?.dataset.id;
  if (
    taskRow &&
    taskId &&
    !e.target.closest(".task-actions, .task-action-tools, button")
  ) {
    activeDetailEditField = null;
    activeDetailEditTaskId = null;
    activeLogDateEditId = null;
    clearActiveSubtaskEdit();
    selectedTaskId = taskId;
    renderTasks();
    return;
  }
});

document.getElementById("taskList").addEventListener("change", (e) => {
  const prioritySelect = e.target.closest(".priority-select");
  const select = e.target.closest(".status-select");
  if (prioritySelect) {
    const task = tasks.find((t) => t.id === prioritySelect.dataset.id);
    if (!task) return;
    task.priority = normalizePriority(prioritySelect.value);
    saveTasks();
    renderTasks({
      preserveOrder: true,
      preserveDetailScroll: true,
      preserveItemsModalScroll: true,
    });
    return;
  }

  if (!select) return;
  const task = tasks.find((t) => t.id === select.dataset.id);
  if (task) {
    applyTaskStatusChange(task, select.value);
    saveTasks();
    renderTasks({
      preserveOrder: true,
      preserveDetailScroll: true,
      preserveItemsModalScroll: true,
    });
  }
});

document.getElementById("taskList").addEventListener("contextmenu", (e) => {
  if (currentViewMode === "table") return;

  const taskRow = e.target.closest("[data-task-row], .task-card");
  const taskId = taskRow?.dataset.taskRow || taskRow?.dataset.id;
  if (!taskRow || !taskId) return;
  if (e.target.closest("input, textarea, select, button")) return;

  e.preventDefault();
  activeDetailEditField = null;
  activeDetailEditTaskId = null;
  clearActiveSubtaskEdit();
  selectedTaskId = taskId;
  renderTasks();
  openDetailContextMenu(e.clientX, e.clientY);
});
