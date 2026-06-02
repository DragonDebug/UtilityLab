import {
  bindApprovalDashboardControls,
  renderApprovalDashboard,
} from "./approvalDashboard.js";
import {
  exportCurrentYearApprovalReportToExcel,
  exportGroupedRecordsToExcel,
} from "./exporter.js";
import { exportCombinedApprovalRecordsToExcel } from "./combinedApprovalExporter.js";
import { parseLines, summarizeParsedRecords } from "./parser.js";

const ITEM_TYPES = [
  {
    key: "profile",
    label: "Profile",
    inputId: "profile-input",
    dropZoneId: "profile-dropzone",
  },
  {
    key: "gaskets",
    label: "Gaskets",
    inputId: "gaskets-input",
    dropZoneId: "gaskets-dropzone",
  },
  {
    key: "accessories",
    label: "Accessories",
    inputId: "accessories-input",
    dropZoneId: "accessories-dropzone",
  },
];

const appState = {
  records: [],
  groupedRecords: createEmptyGroups(),
  validationSummary: summarizeParsedRecords([]),
  importedFileCount: 0,
};

function createEmptyGroups() {
  return Object.fromEntries(ITEM_TYPES.map(({ key }) => [key, []]));
}

function byId(id) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an element with id \"${id}\".`);
  }

  return element;
}

function getButton(id) {
  const button = byId(id);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button with id "${id}".`);
  }

  return button;
}

function getFileInput(id) {
  const input = byId(id);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected file input with id "${id}".`);
  }

  return input;
}

function updateStatus(message) {
  byId("status").textContent = message;
}

function setExportEnabled(isEnabled) {
  getButton("export-button").disabled = !isEnabled;
  getButton("approval-report-export-button").disabled = !isEnabled;
  getButton("combined-approval-export-button").disabled = !isEnabled;
}

function isTextFile(file) {
  return (
    /\.txt$/i.test(file.name) || file.type === "text/plain" || file.type === ""
  );
}

function groupRecordsByItemType(records) {
  const groups = createEmptyGroups();

  for (const record of records) {
    const matchingType = ITEM_TYPES.find(
      ({ label }) => label === record.itemType,
    );
    if (!matchingType) {
      continue;
    }

    groups[matchingType.key].push(record);
  }

  return groups;
}

function createSummaryCard(label, value) {
  const card = document.createElement("article");
  card.className = "summary-card";

  const title = document.createElement("span");
  title.className = "summary-label";
  title.textContent = label;

  const number = document.createElement("strong");
  number.textContent = String(value);

  card.append(title, number);
  return card;
}

function renderSummary() {
  const summary = byId("summary");
  const validationSummary = appState.validationSummary;
  const cards = [
    createSummaryCard("Imported Files", appState.importedFileCount),
    createSummaryCard(
      "Profile Records",
      appState.groupedRecords.profile.length,
    ),
    createSummaryCard(
      "Gaskets Records",
      appState.groupedRecords.gaskets.length,
    ),
    createSummaryCard(
      "Accessories Records",
      appState.groupedRecords.accessories.length,
    ),
    createSummaryCard(
      "Approval Review",
      validationSummary.approval.unmatchedCandidateCount,
    ),
    createSummaryCard("Date Warnings", validationSummary.dates.warningCount),
  ];

  summary.replaceChildren(...cards);
}

function syncState(records) {
  appState.records = records;
  appState.groupedRecords = groupRecordsByItemType(records);
  appState.validationSummary = summarizeParsedRecords(records);
  setExportEnabled(records.length > 0);
  renderSummary();
  renderApprovalDashboard(records);
}

function formatImportStatus(importedFileCount, itemType, ignoredFileCount) {
  const { approval, dates } = appState.validationSummary;
  const ignoredSuffix =
    ignoredFileCount > 0
      ? ` Ignored ${ignoredFileCount} non-text file(s).`
      : "";

  return (
    `Imported ${importedFileCount} ${itemType} file(s). ` +
    `Total records: ${appState.records.length}. ` +
    `${approval.unmatchedCandidateCount} approval patterns need review. ` +
    `${dates.warningCount} date warnings found.` +
    ignoredSuffix
  );
}

async function importFiles(fileList, itemType) {
  const files = Array.from(fileList ?? []);
  if (files.length === 0) {
    return;
  }

  const textFiles = files.filter(isTextFile);
  const ignoredFileCount = files.length - textFiles.length;

  if (textFiles.length === 0) {
    updateStatus(`No .txt files found for ${itemType}.`);
    return;
  }

  updateStatus(`Importing ${textFiles.length} ${itemType} file(s)...`);

  const parsedBatches = await Promise.all(
    textFiles.map(async (file) => parseLines(await file.text(), itemType)),
  );
  const nextRecords = [...appState.records, ...parsedBatches.flat()];

  appState.importedFileCount += textFiles.length;
  syncState(nextRecords);
  updateStatus(
    formatImportStatus(textFiles.length, itemType, ignoredFileCount),
  );
}

function clearImportedData() {
  appState.importedFileCount = 0;
  syncState([]);
  for (const { inputId } of ITEM_TYPES) {
    getFileInput(inputId).value = "";
  }

  updateStatus("Imported data cleared.");
}

function setDropZoneActive(dropZone, isActive) {
  dropZone.classList.toggle("is-dragover", isActive);
}

function bindImportControl({ label, inputId, dropZoneId }) {
  const fileInput = getFileInput(inputId);
  const dropZone = byId(dropZoneId);

  fileInput.addEventListener("change", async () => {
    await importFiles(fileInput.files, label);
    fileInput.value = "";
  });

  dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    setDropZoneActive(dropZone, true);
  });

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    setDropZoneActive(dropZone, true);
  });

  dropZone.addEventListener("dragleave", () => {
    setDropZoneActive(dropZone, false);
  });

  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    setDropZoneActive(dropZone, false);
    await importFiles(event.dataTransfer?.files, label);
  });
}

function bindControls() {
  const exportButton = getButton("export-button");
  const approvalReportExportButton = getButton("approval-report-export-button");
  const combinedApprovalExportButton = getButton(
    "combined-approval-export-button",
  );
  const clearButton = getButton("clear-button");

  for (const itemType of ITEM_TYPES) {
    bindImportControl(itemType);
  }

  clearButton.addEventListener("click", () => {
    clearImportedData();
  });

  exportButton.addEventListener("click", async () => {
    if (appState.records.length === 0) {
      updateStatus("Import data before exporting.");
      return;
    }

    exportButton.disabled = true;
    updateStatus("Exporting Excel workbook...");

    try {
      await exportGroupedRecordsToExcel(appState.groupedRecords);
      updateStatus("Excel workbook exported.");
    } catch (error) {
      updateStatus("Excel export failed.");
      console.error("Excel export failed.", error);
    } finally {
      exportButton.disabled = false;
    }
  });

  approvalReportExportButton.addEventListener("click", async () => {
    if (appState.records.length === 0) {
      updateStatus("Import data before exporting the approval report.");
      return;
    }

    approvalReportExportButton.disabled = true;
    updateStatus("Exporting current-year approval report...");

    try {
      await exportCurrentYearApprovalReportToExcel(appState.records);
      updateStatus("Current-year approval report exported.");
    } catch (error) {
      updateStatus("Approval report export failed.");
      console.error("Approval report export failed.", error);
    } finally {
      approvalReportExportButton.disabled = false;
    }
  });

  combinedApprovalExportButton.addEventListener("click", async () => {
    if (appState.records.length === 0) {
      updateStatus("Import data before exporting combined approvals.");
      return;
    }

    combinedApprovalExportButton.disabled = true;
    updateStatus("Exporting combined approval workbook...");

    try {
      await exportCombinedApprovalRecordsToExcel(appState.records);
      updateStatus("Combined approval workbook exported.");
    } catch (error) {
      updateStatus("Combined approval export failed.");
      console.error("Combined approval export failed.", error);
    } finally {
      combinedApprovalExportButton.disabled = false;
    }
  });
}

function initialize() {
  setExportEnabled(false);
  renderSummary();
  renderApprovalDashboard(appState.records);
  updateStatus(
    "Import one or more text files into Profile, Gaskets, or Accessories.",
  );
  bindControls();
  bindApprovalDashboardControls();
}

initialize();
