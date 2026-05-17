// App-level workflow shell.

document.getElementById("clearCompletedBtn").addEventListener("click", () => {
  const completedCount = tasks.filter((task) => isTaskCompleted(task)).length;
  if (!completedCount) {
    alert("There are no completed tasks to clean up right now.");
    return;
  }

  const cleanupChoice = prompt(
    `Clear Done options:\n1 = Delete all completed tasks\n2 = Delete completed tasks older than ${getCompletedTaskCleanupDays()} days\n3 = Delete completed tasks completed before year ${getCompletedTaskCleanupBeforeYear()}\n\nEnter 1, 2, or 3.`,
    "2",
  );
  if (cleanupChoice === null) return;

  const normalizedChoice = cleanupChoice.trim();
  let cleanupCriteria = { mode: "all" };
  let cleanupRuleLabel = "All completed tasks";

  if (normalizedChoice === "2") {
    const daysInput = prompt(
      "Delete completed tasks older than how many days?",
      String(getCompletedTaskCleanupDays()),
    );
    if (daysInput === null) return;

    const days = normalizePositiveInteger(daysInput, null, 1, 3650);
    if (!Number.isInteger(days)) {
      alert("Enter a valid number of days.");
      return;
    }

    cleanupCriteria = { mode: "older-than-days", days };
    cleanupRuleLabel = `Completed tasks older than ${days} day${days === 1 ? "" : "s"}`;
  } else if (normalizedChoice === "3") {
    const yearInput = prompt(
      "Delete completed tasks completed before which year?",
      String(getCompletedTaskCleanupBeforeYear()),
    );
    if (yearInput === null) return;

    const year = normalizePositiveInteger(yearInput, null, 2000, 9999);
    if (!Number.isInteger(year)) {
      alert("Enter a valid year.");
      return;
    }

    cleanupCriteria = { mode: "before-year", year };
    cleanupRuleLabel = `Completed tasks finished before ${year}`;
  } else if (normalizedChoice !== "1") {
    alert("Enter 1, 2, or 3 to choose a cleanup option.");
    return;
  }

  const tasksToDelete = getCompletedTasksForCleanup(cleanupCriteria);
  if (!tasksToDelete.length) {
    alert(`No matching tasks were found for this rule: ${cleanupRuleLabel}.`);
    return;
  }

  const taskCount = tasksToDelete.length;
  if (
    confirm(
      `Permanently delete ${taskCount} matching completed task${taskCount === 1 ? "" : "s"} plus their logs and linked items?\n\nRule: ${cleanupRuleLabel}.`,
    )
  ) {
    clearCompletedTasks(cleanupCriteria);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDetailContextMenu();
    closeModal();
    closeCategoryModal();
    closeTemplateModal();
    closeItemsModal();
    closeReportModal();
  }
});

document.addEventListener("click", (e) => {
  if (e.target.closest("#detailContextMenu")) return;
  closeDetailContextMenu();
});

window.addEventListener("resize", closeDetailContextMenu);
document.addEventListener("scroll", closeDetailContextMenu, true);

async function initializeApp() {
  await loadState();
  applyTheme(currentTheme);
  saveCategories();
  saveTasks();
  saveItems();
  saveItemSettings();
  saveHiddenFilters();
  saveTemplates();
  renderAppState();
}

initializeApp().catch((error) => {
  console.error("Task Manager failed to initialize.", error);
  alert("Task Manager failed to initialize. Reload the page and try again.");
});
