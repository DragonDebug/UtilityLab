// These bindings cover shared modal chrome, report controls, backdrop dismiss,
// and the All Items search box without pulling domain-heavy list workflows in.
document
  .getElementById("exportDetailedExcelBtn")
  .addEventListener("click", () => {
    exportDetailedToExcel();
  });

document
  .getElementById("printReportBtn")
  .addEventListener("click", printReportDashboard);
document
  .getElementById("closeReportModalBtn")
  .addEventListener("click", closeReportModal);
document.getElementById("reportPeriodSwitch").addEventListener("click", (e) => {
  const nextPeriod = e.target.closest("[data-report-period]")?.dataset
    .reportPeriod;
  if (!nextPeriod || nextPeriod === currentReportPeriod) return;

  currentReportPeriod = nextPeriod;
  renderReportDashboard();
});

document.getElementById("cancelTaskBtn").addEventListener("click", closeModal);
document
  .getElementById("closeTaskModalBtn")
  .addEventListener("click", closeModal);
document.getElementById("taskDatesToggleBtn").addEventListener("click", () => {
  const isExpanded =
    document
      .getElementById("taskDatesToggleBtn")
      .getAttribute("aria-expanded") === "true";
  setTaskDatesExpanded(!isExpanded);
});

document
  .getElementById("closeCategoryModalBtn")
  .addEventListener("click", closeCategoryModal);
document
  .getElementById("cancelCategoryBtn")
  .addEventListener("click", closeCategoryModal);
document
  .getElementById("closeTemplateModalBtn")
  .addEventListener("click", closeTemplateModal);
document
  .getElementById("cancelTemplateBtn")
  .addEventListener("click", closeTemplateModal);
document
  .getElementById("closeItemSettingsModalBtn")
  .addEventListener("click", closeItemSettingsModal);
document
  .getElementById("cancelItemSettingsBtn")
  .addEventListener("click", closeItemSettingsModal);
document
  .getElementById("closeItemsModalBtn")
  .addEventListener("click", closeItemsModal);
document
  .getElementById("closeItemsBtn")
  .addEventListener("click", closeItemsModal);

bindBackdropDismiss("taskModal", closeModal);
bindBackdropDismiss("categoryModal", closeCategoryModal);
bindBackdropDismiss("templateModal", closeTemplateModal);
bindBackdropDismiss("itemSettingsModal", closeItemSettingsModal);
bindBackdropDismiss("itemsModal", closeItemsModal);
bindBackdropDismiss("reportModal", closeReportModal);

document.getElementById("itemSearchInput").addEventListener("input", (e) => {
  itemSearchQuery = e.target.value.trim().toLowerCase();
  renderAllItemsList();
});
