const SHEET_ORDER = [
  ["profile", "Profile"],
  ["gaskets", "Gaskets"],
  ["accessories", "Accessories"],
];

const RECORD_CATEGORIES = {
  FCDD: "FCDD",
  PRELIMINARY: "Preliminary CAD die drwg",
  CDD_APPROVAL: "CDD approvals",
  SAM_APPROVAL: "SAM approvals",
  OTHERS: "Others",
};

const EXCEL_DATE_FORMAT = "yyyy-mm-dd";
const DOWNLOAD_FILE_NAME = "data-analyser-export.xlsx";
const TABLE_COLUMNS = [
  { key: "itemType", label: "Item Type", width: 18 },
  { key: "category", label: "Category", width: 26 },
  { key: "fileName", label: "File Name", width: 36 },
  { key: "path", label: "Path", width: 84 },
  { key: "project", label: "Project", width: 28 },
  { key: "supplier", label: "Supplier", width: 24 },
  { key: "system", label: "System", width: 22 },
  { key: "referenceNumber", label: "Reference Number", width: 22 },
  { key: "dieNumber", label: "Die Number", width: 18 },
  { key: "approvalChunk", label: "Approval Chunk", width: 32 },
  { key: "approvalType", label: "Approval Type", width: 24 },
  { key: "approvalRuleKey", label: "Approval Rule", width: 28 },
  {
    key: "approvalPatternUnmatched",
    label: "Approval Needs Review",
    width: 20,
  },
  { key: "approvalStatus", label: "Approval Status", width: 28 },
  { key: "rawDate", label: "Raw Date", width: 16 },
  { key: "date", label: "Date", width: 16 },
  { key: "dateValidationStatus", label: "Date Validation", width: 18 },
  { key: "dateWasReordered", label: "Date Reordered", width: 16 },
  { key: "dateIsFuture", label: "Date Is Future", width: 16 },
  { key: "revision", label: "Revision", width: 14 },
  { key: "fileType", label: "File Type", width: 14 },
  { key: "validationNotes", label: "Validation Notes", width: 48 },
  { key: "fcdd", label: "FCDD", width: 12 },
];

function getRecordCategory(record) {
  if (record.fcdd) {
    return RECORD_CATEGORIES.FCDD;
  }

  if (/PRELIMINARY CAD DIE DRWG/i.test(record.path)) {
    return RECORD_CATEGORIES.PRELIMINARY;
  }

  if (record.approvalType === "Counter Die Drawing") {
    return RECORD_CATEGORIES.CDD_APPROVAL;
  }

  if (record.approvalType === "Sample") {
    return RECORD_CATEGORIES.SAM_APPROVAL;
  }

  return RECORD_CATEGORIES.OTHERS;
}

function getExcelLibrary() {
  const workbookLibrary = globalThis.ExcelJS;
  if (!workbookLibrary?.Workbook) {
    throw new Error("ExcelJS library is not loaded.");
  }

  return workbookLibrary;
}

function toExcelDate(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toWorksheetRows(records) {
  return records.map((record) => ({
    itemType: record.itemType,
    category: getRecordCategory(record),
    fileName: record.fileName,
    path: record.path,
    project: record.project,
    supplier: record.supplier,
    system: record.system,
    referenceNumber: record.referenceNumber,
    dieNumber: record.dieNumber,
    approvalChunk: record.approvalChunk,
    approvalType: record.approvalType,
    approvalRuleKey: record.approvalRuleKey,
    approvalPatternUnmatched: record.approvalPatternUnmatched,
    approvalStatus: record.approvalStatus,
    rawDate: record.rawDate,
    date: toExcelDate(record.date),
    dateValidationStatus: record.dateValidationStatus,
    dateWasReordered: record.dateWasReordered,
    dateIsFuture: record.dateIsFuture,
    revision: record.revision,
    fileType: record.fileType,
    validationNotes: record.validationNotes,
    fcdd: record.fcdd,
  }));
}

function buildWorkbookData(groupedRecords) {
  return {
    profile: toWorksheetRows(groupedRecords.profile ?? []),
    gaskets: toWorksheetRows(groupedRecords.gaskets ?? []),
    accessories: toWorksheetRows(groupedRecords.accessories ?? []),
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

function toTableRows(rows) {
  return rows.map((row) =>
    TABLE_COLUMNS.map(({ key }) => {
      const value = row[key];
      return value ?? null;
    }),
  );
}

function setWorksheetColumns(worksheet) {
  worksheet.columns = TABLE_COLUMNS.map(({ key, width }) => ({
    key,
    width,
  }));
}

function formatDateColumn(worksheet) {
  const dateColumnIndex =
    TABLE_COLUMNS.findIndex(({ key }) => key === "date") + 1;
  const dateColumn = worksheet.getColumn(dateColumnIndex);
  dateColumn.numFmt = EXCEL_DATE_FORMAT;
}

function appendSheet(workbook, sheetName, rows) {
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  setWorksheetColumns(worksheet);
  worksheet.addTable({
    name: sanitizeTableName(sheetName),
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: TABLE_COLUMNS.map(({ label }) => ({
      name: label,
      filterButton: true,
    })),
    rows: toTableRows(rows),
  });

  formatDateColumn(worksheet);
}

function downloadWorkbook(buffer) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = DOWNLOAD_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportGroupedRecordsToExcel(groupedRecords) {
  const workbookLibrary = getExcelLibrary();
  const workbook = new workbookLibrary.Workbook();
  const workbookData = buildWorkbookData(groupedRecords);

  workbook.created = new Date();
  workbook.modified = new Date();

  for (const [key, label] of SHEET_ORDER) {
    appendSheet(workbook, label, workbookData[key] ?? []);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(buffer);
}
