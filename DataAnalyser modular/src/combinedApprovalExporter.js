import { PROJECTS, SUPPLIERS, SYSTEMS } from "./constants.js";

const APPROVAL_TYPE_KEYS = {
  CDD: "Counter Die Drawing",
  SAM: "Sample",
};

const CATEGORIES = ["Profile", "Gaskets", "Accessories"];
const DOWNLOAD_FILE_NAME = "data-analyser-combined-approvals.xlsx";
const COMBINED_APPROVALS_SHEET_NAME = "Combined Approvals";
const EXCEL_DATE_FORMAT = "dd-mmm-yy";
const COMBINED_APPROVAL_COLUMNS = [
  { key: "supplier", label: "Supplier", width: 24 },
  { key: "referenceNumber", label: "Reference Number", width: 22 },
  { key: "categories", label: "Categories", width: 28 },
  { key: "projects", label: "Projects", width: 34 },
  { key: "systems", label: "Systems", width: 26 },
  { key: "recordCount", label: "Record Count", width: 14 },
  { key: "cddStatuses", label: "CDD Statuses", width: 34 },
  { key: "cddDates", label: "CDD Dates", width: 34 },
  { key: "cddLatestDate", label: "CDD Latest Date", width: 18 },
  { key: "cddRevisions", label: "CDD Revisions", width: 24 },
  { key: "samStatuses", label: "SAM Statuses", width: 34 },
  { key: "samDates", label: "SAM Dates", width: 34 },
  { key: "samLatestDate", label: "SAM Latest Date", width: 18 },
  { key: "samRevisions", label: "SAM Revisions", width: 24 },
];

function getExcelLibrary() {
  const workbookLibrary = globalThis.ExcelJS;
  if (!workbookLibrary?.Workbook) {
    throw new Error("ExcelJS library is not loaded.");
  }

  return workbookLibrary;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSupplierKey(value) {
  return cleanText(value).toUpperCase();
}

function normalizeReferenceDisplay(value) {
  return cleanText(value).toUpperCase();
}

export function normalizeReferenceComparisonKey(value) {
  const normalizedReference = normalizeReferenceDisplay(value);
  return normalizedReference.startsWith("T")
    ? normalizedReference.slice(1)
    : normalizedReference;
}

function isApprovalRecord(record) {
  return (
    record?.approvalType === APPROVAL_TYPE_KEYS.CDD ||
    record?.approvalType === APPROVAL_TYPE_KEYS.SAM
  );
}

function createGroup(record, referenceComparisonKey) {
  return {
    supplier: cleanText(record.supplier),
    referenceNumber: normalizeReferenceDisplay(record.referenceNumber),
    referenceComparisonKey,
    records: [],
    cddRecords: [],
    samRecords: [],
    categories: [],
    projects: [],
    systems: [],
  };
}

function preferDisplayReference(currentReference, nextReference) {
  if (!currentReference) {
    return nextReference;
  }

  if (!nextReference) {
    return currentReference;
  }

  const currentHasLeadingT = currentReference.startsWith("T");
  const nextHasLeadingT = nextReference.startsWith("T");
  if (nextHasLeadingT && !currentHasLeadingT) {
    return nextReference;
  }

  return currentReference.length >= nextReference.length
    ? currentReference
    : nextReference;
}

function addDistinct(values, value) {
  const cleanedValue = cleanText(value);
  if (cleanedValue && !values.includes(cleanedValue)) {
    values.push(cleanedValue);
  }
}

function getRecordSortValue(record) {
  return [
    cleanText(record.date) || "9999-99-99",
    String(Number(record.revision ?? 0)).padStart(8, "0"),
    cleanText(record.fileName),
  ].join("|");
}

function sortApprovalRecords(records) {
  return [...records].sort((left, right) =>
    getRecordSortValue(left).localeCompare(getRecordSortValue(right)),
  );
}

function formatList(values) {
  const cleanedValues = values.map(cleanText).filter(Boolean);
  return cleanedValues.length > 0 ? `[${cleanedValues.join(",")}]` : "";
}

function formatDisplayDate(value) {
  const cleanedValue = cleanText(value);
  const match = cleanedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return cleanedValue;
  }

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  const monthLabel = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ][monthIndex];

  if (!monthLabel) {
    return cleanedValue;
  }

  return `${day}-${monthLabel}-${year.slice(-2)}`;
}

function toExcelDate(value) {
  const cleanedValue = cleanText(value);
  const match = cleanedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatRevision(value) {
  const revisionNumber = Number(cleanText(value) || "0");
  if (Number.isFinite(revisionNumber)) {
    return String(revisionNumber).padStart(2, "0");
  }

  return cleanText(value);
}

function getLatestDate(records) {
  const dates = records.map((record) => cleanText(record.date)).filter(Boolean);
  if (dates.length === 0) {
    return null;
  }

  return dates.sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

function getApprovalSummary(records) {
  const sortedRecords = sortApprovalRecords(records);
  const revisions = sortedRecords
    .map((record) => formatRevision(record.revision))
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );

  return {
    statuses: formatList(sortedRecords.map((record) => record.approvalStatus)),
    dates: formatList(
      sortedRecords.map((record) => formatDisplayDate(record.date)),
    ),
    latestDate: getLatestDate(sortedRecords),
    revisions: formatList(revisions),
  };
}

function toCombinedApprovalRow(group) {
  const cddSummary = getApprovalSummary(group.cddRecords);
  const samSummary = getApprovalSummary(group.samRecords);

  return {
    supplier: group.supplier,
    referenceNumber: group.referenceNumber,
    categories: formatList(group.categories),
    projects: formatList(group.projects),
    systems: formatList(group.systems),
    recordCount: group.records.length,
    cddStatuses: cddSummary.statuses,
    cddDates: cddSummary.dates,
    cddLatestDate: toExcelDate(cddSummary.latestDate),
    cddRevisions: cddSummary.revisions,
    samStatuses: samSummary.statuses,
    samDates: samSummary.dates,
    samLatestDate: toExcelDate(samSummary.latestDate),
    samRevisions: samSummary.revisions,
  };
}

function toCatalogRows(values, key) {
  return values.map((value) => ({ [key]: value }));
}

export function buildCombinedApprovalWorkbookData(records) {
  const groups = new Map();
  let skippedMissingKeyCount = 0;
  let skippedNonApprovalCount = 0;

  for (const record of records ?? []) {
    if (!isApprovalRecord(record)) {
      skippedNonApprovalCount += 1;
      continue;
    }

    const supplier = cleanText(record.supplier);
    const referenceNumber = normalizeReferenceDisplay(record.referenceNumber);
    const referenceComparisonKey =
      normalizeReferenceComparisonKey(referenceNumber);

    if (!supplier || !referenceComparisonKey) {
      skippedMissingKeyCount += 1;
      continue;
    }

    const groupKey = `${normalizeSupplierKey(supplier)}|${referenceComparisonKey}`;
    const group =
      groups.get(groupKey) ?? createGroup(record, referenceComparisonKey);
    group.referenceNumber = preferDisplayReference(
      group.referenceNumber,
      referenceNumber,
    );
    group.records.push(record);
    addDistinct(group.categories, record.itemType);
    addDistinct(group.projects, record.project);
    addDistinct(group.systems, record.system);

    if (record.approvalType === APPROVAL_TYPE_KEYS.CDD) {
      group.cddRecords.push(record);
    } else if (record.approvalType === APPROVAL_TYPE_KEYS.SAM) {
      group.samRecords.push(record);
    }

    groups.set(groupKey, group);
  }

  const combinedRows = Array.from(groups.values())
    .map(toCombinedApprovalRow)
    .sort((left, right) =>
      `${left.supplier}|${left.referenceNumber}`.localeCompare(
        `${right.supplier}|${right.referenceNumber}`,
      ),
    );

  return {
    combinedRows,
    suppliers: toCatalogRows(SUPPLIERS, "supplier"),
    projects: toCatalogRows(PROJECTS, "project"),
    systems: toCatalogRows(SYSTEMS, "system"),
    categories: toCatalogRows(CATEGORIES, "category"),
    summary: {
      combinedRowCount: combinedRows.length,
      skippedMissingKeyCount,
      skippedNonApprovalCount,
    },
  };
}

function sanitizeTableName(sheetName) {
  const compactName = sheetName.replace(/[^A-Za-z0-9]+/g, " ").trim();
  const words = compactName.split(/\s+/).filter(Boolean);
  const pascalName = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  return `tbl${pascalName || "Sheet"}`;
}

function setWorksheetColumns(worksheet, columns) {
  worksheet.columns = columns.map(({ key, width }) => ({
    key,
    width,
  }));
}

function appendHeaderOnlySheet(worksheet, columns) {
  const headerRow = worksheet.addRow(columns.map(({ label }) => label));
  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3E7CB1" },
    };
  });
}

function appendTableSheet(workbook, sheetName, columns, rows) {
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  setWorksheetColumns(worksheet, columns);

  for (const dateKey of ["cddLatestDate", "samLatestDate"]) {
    const columnIndex = columns.findIndex(({ key }) => key === dateKey) + 1;
    if (columnIndex > 0) {
      worksheet.getColumn(columnIndex).numFmt = EXCEL_DATE_FORMAT;
    }
  }

  if ((rows ?? []).length === 0) {
    appendHeaderOnlySheet(worksheet, columns);
    return;
  }

  worksheet.addTable({
    name: sanitizeTableName(sheetName),
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: columns.map(({ label }) => ({
      name: label,
      filterButton: true,
    })),
    rows: rows.map((row) => columns.map(({ key }) => row[key] ?? null)),
  });
}

function appendCatalogSheet(workbook, sheetName, key, label, rows) {
  appendTableSheet(workbook, sheetName, [{ key, label, width: 34 }], rows);
}

function downloadWorkbook(buffer, fileName = DOWNLOAD_FILE_NAME) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportCombinedApprovalRecordsToExcel(records) {
  const workbookLibrary = getExcelLibrary();
  const workbook = new workbookLibrary.Workbook();
  const workbookData = buildCombinedApprovalWorkbookData(records);

  workbook.created = new Date();
  workbook.modified = new Date();

  appendTableSheet(
    workbook,
    COMBINED_APPROVALS_SHEET_NAME,
    COMBINED_APPROVAL_COLUMNS,
    workbookData.combinedRows,
  );
  appendCatalogSheet(
    workbook,
    "Suppliers",
    "supplier",
    "Supplier",
    workbookData.suppliers,
  );
  appendCatalogSheet(
    workbook,
    "Projects",
    "project",
    "Project",
    workbookData.projects,
  );
  appendCatalogSheet(
    workbook,
    "Systems",
    "system",
    "System",
    workbookData.systems,
  );
  appendCatalogSheet(
    workbook,
    "Categories",
    "category",
    "Category",
    workbookData.categories,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(buffer);
}