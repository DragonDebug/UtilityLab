// Filters and toolbar controls stay thin here: read UI input, update current
// preferences or view state, then delegate to the existing render/workflow code.
document
  .getElementById("searchTasks")
  .addEventListener("input", () => renderTasks({ recomputeOrder: true }));
document
  .getElementById("filterCategory")
  .addEventListener("change", () => renderTasks({ recomputeOrder: true }));
document
  .getElementById("filterPriority")
  .addEventListener("change", () => renderTasks({ recomputeOrder: true }));
document
  .getElementById("filterStatus")
  .addEventListener("change", () => renderTasks({ recomputeOrder: true }));
document.getElementById("sortTasks").addEventListener("change", (e) => {
  currentSortMode = normalizeTaskSortMode(e.target.value);
  saveSortModePreference();
  renderTasks({ recomputeOrder: true });
});

document.getElementById("applyTaskSortingBtn").addEventListener("click", () => {
  renderTasks({
    recomputeOrder: true,
    preserveDetailScroll: true,
    preserveItemsModalScroll: true,
  });
});

document.getElementById("taskViewSwitch").addEventListener("click", (e) => {
  const nextViewMode = e.target.closest("[data-view-mode]")?.dataset.viewMode;
  if (!nextViewMode) return;

  const normalizedViewMode = normalizeTaskViewMode(nextViewMode);
  if (normalizedViewMode === currentViewMode) return;

  currentViewMode = normalizedViewMode;
  saveViewModePreference();
  renderTasks({ recomputeOrder: true });
});

document.getElementById("toggleDoneBtn").addEventListener("click", () => {
  hideDone = !hideDone;
  saveHideDonePreference();
  updateCompletedVisibilityToggleLabel();
  renderTasks({ recomputeOrder: true });
});

document
  .getElementById("toggleTaskStatsSecondaryBtn")
  .addEventListener("click", () => {
    showSecondaryStats = !showSecondaryStats;
    saveSecondaryStatsPreference();
    updateSecondaryStatsToggle();
  });

document
  .getElementById("taskStatsSecondaryShell")
  .addEventListener("click", (e) => {
    const categoryPageDirection = e.target.closest("[data-category-page-dir]")
      ?.dataset.categoryPageDir;
    if (categoryPageDirection) {
      const pageDelta = categoryPageDirection === "next" ? 1 : -1;
      activeCategoryStatsPage = Math.max(
        0,
        activeCategoryStatsPage + pageDelta,
      );
      renderStats();
      return;
    }

    const statsTabId = e.target.closest("[data-stats-tab]")?.dataset.statsTab;
    if (!statsTabId || statsTabId === activeSecondaryStatsTab) return;
    activeSecondaryStatsTab = statsTabId;
    saveActiveSecondaryStatsTabPreference();
    if (statsTabId === "category") {
      activeCategoryStatsPage = 0;
    }
    renderStats();
  });

document
  .getElementById("newTaskBtn")
  .addEventListener("click", () => openModal());
document
  .getElementById("openReportsBtn")
  .addEventListener("click", openReportModal);
document
  .getElementById("themeToggleBtn")
  .addEventListener("click", toggleTheme);
document
  .getElementById("manageCategoriesBtn")
  .addEventListener("click", () => openCategoryModal());
document
  .getElementById("manageTemplatesBtn")
  .addEventListener("click", () => openTemplateModal());
document
  .getElementById("manageItemsBtn")
  .addEventListener("click", () => openItemsModal());
document
  .getElementById("manageItemSettingsBtn")
  .addEventListener("click", () => openItemSettingsModal());
