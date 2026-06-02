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

const EXCEL_DATE_FORMAT = "dd-mmm-yy";
const DOWNLOAD_FILE_NAME = "data-analyser-export.xlsx";
const APPROVAL_REPORT_FILE_PREFIX = "data-analyser-approvals";
const APPROVAL_SUMMARY_SHEET_NAME = "YTD Summary";
const APPROVAL_MONTHLY_SHEET_NAME = "Items by Month";
const APPROVAL_ITEM_TYPES = ["Profile", "Gaskets", "Accessories"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const APPROVAL_TYPE_KEYS = {
  CDD: "Counter Die Drawing",
  SAM: "Sample",
};
const APPROVAL_REPORT_SUMMARY_COLUMNS = [
  { key: "category", label: "Category", width: 24 },
  { key: "cdd", label: "CDD", width: 12 },
  { key: "sam", label: "SAM", width: 12 },
  { key: "total", label: "Total", width: 12 },
];
const APPROVAL_REPORT_MONTHLY_COLUMNS = [
  { key: "month", label: "Month", width: 18 },
  { key: "cdd", label: "CDD", width: 12 },
  { key: "sam", label: "SAM", width: 12 },
  { key: "total", label: "Total", width: 12 },
];
const APPROVAL_REPORT_CHART_COLORS = {
  cdd: "#07868f",
  sam: "#f08a24",
  text: "#132635",
  muted: "#4e6474",
  grid: "#d7e3e8",
  axis: "#9cb0bc",
  background: "#ffffff",
};
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
  { key: "approvalStatus", label: "Approval Status", width: 28 },
  { key: "date", label: "Date", width: 16 },
  { key: "revision", label: "Revision", width: 14 },
  { key: "fileType", label: "File Type", width: 14 },
  { key: "validationNotes", label: "Validation Notes", width: 48 },
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
    approvalStatus: record.approvalStatus,
    date: toExcelDate(record.date),
    revision: record.revision,
    fileType: record.fileType,
    validationNotes: record.validationNotes,
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

function setCustomWorksheetColumns(worksheet, columns) {
  worksheet.columns = columns.map(({ key, width }) => ({
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

function appendEmptySheetHeaderRow(worksheet) {
  const headerRow = worksheet.addRow(TABLE_COLUMNS.map(({ label }) => label));
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
    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };
  });
}

function appendSheet(workbook, sheetName, rows) {
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  setWorksheetColumns(worksheet);
  if ((rows ?? []).length === 0) {
    // Some ExcelJS/browser combinations can throw when creating a table with no data rows.
    // Keep the sheet exportable by writing only the header row for empty datasets.
    appendEmptySheetHeaderRow(worksheet);
    formatDateColumn(worksheet);
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
    columns: TABLE_COLUMNS.map(({ label }) => ({
      name: label,
      filterButton: true,
    })),
    rows: toTableRows(rows),
  });

  formatDateColumn(worksheet);
}

function appendObjectTable(worksheet, tableName, ref, columns, rows, theme) {
  worksheet.addTable({
    name: sanitizeTableName(tableName),
    ref,
    headerRow: true,
    totalsRow: false,
    style: {
      theme,
      showRowStripes: true,
    },
    columns: columns.map(({ label }) => ({
      name: label,
      filterButton: false,
    })),
    rows: rows.map((row) =>
      columns.map(({ key }) => {
        const value = row[key];
        return value ?? null;
      }),
    ),
  });
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

function extractIsoDateParts(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function isApprovalReportRecord(record, currentYear) {
  if (record.fileType !== "pdf") {
    return false;
  }

  if (
    record.approvalType !== APPROVAL_TYPE_KEYS.CDD &&
    record.approvalType !== APPROVAL_TYPE_KEYS.SAM
  ) {
    return false;
  }

  const dateParts = extractIsoDateParts(record.date);
  if (!dateParts) {
    return false;
  }

  return dateParts.year === currentYear;
}

function createApprovalCountRow(category) {
  return {
    category,
    cdd: 0,
    sam: 0,
    total: 0,
  };
}

function getReferenceYear(referenceDate = new Date()) {
  const safeDate =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  return Number.isNaN(safeDate.valueOf())
    ? new Date().getFullYear()
    : safeDate.getFullYear();
}

export function buildCurrentYearApprovalReportData(
  records,
  referenceDate = new Date(),
) {
  const currentYear = getReferenceYear(referenceDate);
  const summaryByCategory = new Map([
    ["All Categories", createApprovalCountRow("All Categories")],
    ...APPROVAL_ITEM_TYPES.map((itemType) => [
      itemType,
      createApprovalCountRow(itemType),
    ]),
  ]);
  const monthlyRows = MONTH_LABELS.map((month) => ({
    month,
    cdd: 0,
    sam: 0,
    total: 0,
  }));
  let includedRecordCount = 0;
  let excludedNonPdfCount = 0;
  let excludedInvalidDateCount = 0;
  let excludedOtherYearCount = 0;

  for (const record of records ?? []) {
    const isApprovalCandidate =
      record.approvalType === APPROVAL_TYPE_KEYS.CDD ||
      record.approvalType === APPROVAL_TYPE_KEYS.SAM;

    if (!isApprovalCandidate) {
      continue;
    }

    if (record.fileType !== "pdf") {
      excludedNonPdfCount += 1;
      continue;
    }

    const dateParts = extractIsoDateParts(record.date);
    if (!dateParts) {
      excludedInvalidDateCount += 1;
      continue;
    }

    if (dateParts.year !== currentYear) {
      excludedOtherYearCount += 1;
      continue;
    }

    includedRecordCount += 1;
    const approvalKey =
      record.approvalType === APPROVAL_TYPE_KEYS.CDD ? "cdd" : "sam";
    const allCategoriesRow = summaryByCategory.get("All Categories");
    allCategoriesRow[approvalKey] += 1;
    allCategoriesRow.total += 1;

    const itemTypeRow = summaryByCategory.get(record.itemType);
    if (itemTypeRow) {
      itemTypeRow[approvalKey] += 1;
      itemTypeRow.total += 1;
    }

    const monthRow = monthlyRows[dateParts.month - 1];
    if (monthRow) {
      monthRow[approvalKey] += 1;
      monthRow.total += 1;
    }
  }

  const summaryRows = [
    summaryByCategory.get("All Categories"),
    ...APPROVAL_ITEM_TYPES.map((itemType) => summaryByCategory.get(itemType)),
  ];

  return {
    currentYear,
    summaryRows,
    monthlyRows,
    totals: { ...summaryRows[0] },
    chartRows: summaryRows,
    includedRecordCount,
    excludedCounts: {
      nonPdf: excludedNonPdfCount,
      invalidDate: excludedInvalidDateCount,
      otherYear: excludedOtherYearCount,
    },
    notes: [
      `Scope: PDF-only CDD and SAM approvals with valid ${currentYear} dates.`,
      "Inclusions: all approval statuses and revision records remain included.",
      "Exclusions: DWG files, undated approvals, and records outside the current year.",
    ],
  };
}

function addTitleBlock(worksheet, reportData) {
  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value = `${reportData.currentYear} Approval Report`;
  worksheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FF132635" },
  };

  worksheet.mergeCells("A2:D2");
  worksheet.getCell("A2").value =
    "YTD summary and monthly breakdown for current-year PDF CDD and SAM approvals.";
  worksheet.getCell("A2").font = {
    italic: true,
    size: 10,
    color: { argb: "FF4E6474" },
  };

  reportData.notes.forEach((note, index) => {
    const cell = worksheet.getCell(`A${4 + index}`);
    cell.value = note;
    cell.font = {
      size: 10,
      color: { argb: "FF4E6474" },
    };
  });
}

function applyCountNumberFormat(worksheet, columns) {
  for (const columnLetter of columns) {
    worksheet.getColumn(columnLetter).numFmt = "0";
  }
}

function createApprovalReportChartBase64(reportData) {
  if (!globalThis.document?.createElement) {
    return null;
  }

  const canvas = globalThis.document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const rows = reportData.chartRows;
  const width = canvas.width;
  const height = canvas.height;
  const chartLeft = 72;
  const chartTop = 70;
  const chartWidth = width - chartLeft - 36;
  const chartHeight = height - chartTop - 70;
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.cdd, row.sam]));

  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.text;
  context.font = "700 24px 'Segoe UI', Arial, sans-serif";
  context.fillText("Current-Year CDD and SAM Totals", 28, 34);
  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.muted;
  context.font = "14px 'Segoe UI', Arial, sans-serif";
  context.fillText("PDF approval records by category", 28, 56);

  context.strokeStyle = APPROVAL_REPORT_CHART_COLORS.grid;
  context.lineWidth = 1;
  const gridSteps = 4;
  for (let step = 0; step <= gridSteps; step += 1) {
    const y = chartTop + (chartHeight / gridSteps) * step;
    const value = Math.round(maxValue - (maxValue / gridSteps) * step);
    context.beginPath();
    context.moveTo(chartLeft, y);
    context.lineTo(chartLeft + chartWidth, y);
    context.stroke();
    context.fillStyle = APPROVAL_REPORT_CHART_COLORS.muted;
    context.font = "12px 'Segoe UI', Arial, sans-serif";
    context.fillText(String(value), 28, y + 4);
  }

  context.strokeStyle = APPROVAL_REPORT_CHART_COLORS.axis;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(chartLeft, chartTop);
  context.lineTo(chartLeft, chartTop + chartHeight);
  context.lineTo(chartLeft + chartWidth, chartTop + chartHeight);
  context.stroke();

  const groupWidth = chartWidth / Math.max(1, rows.length);
  const barWidth = Math.min(32, groupWidth * 0.24);
  const gap = 8;
  const baseline = chartTop + chartHeight;

  rows.forEach((row, index) => {
    const centerX = chartLeft + groupWidth * index + groupWidth / 2;
    const cddHeight = (row.cdd / maxValue) * (chartHeight - 12);
    const samHeight = (row.sam / maxValue) * (chartHeight - 12);
    const cddX = centerX - barWidth - gap / 2;
    const samX = centerX + gap / 2;

    context.fillStyle = APPROVAL_REPORT_CHART_COLORS.cdd;
    context.fillRect(cddX, baseline - cddHeight, barWidth, cddHeight);
    context.fillStyle = APPROVAL_REPORT_CHART_COLORS.sam;
    context.fillRect(samX, baseline - samHeight, barWidth, samHeight);

    context.fillStyle = APPROVAL_REPORT_CHART_COLORS.text;
    context.font = "12px 'Segoe UI', Arial, sans-serif";
    context.textAlign = "center";
    if (row.cdd > 0) {
      context.fillText(
        String(row.cdd),
        cddX + barWidth / 2,
        baseline - cddHeight - 8,
      );
    }
    if (row.sam > 0) {
      context.fillText(
        String(row.sam),
        samX + barWidth / 2,
        baseline - samHeight - 8,
      );
    }
    context.fillStyle = APPROVAL_REPORT_CHART_COLORS.muted;
    context.fillText(row.category, centerX, baseline + 22);
  });

  context.textAlign = "left";
  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.text;
  context.fillRect(width - 186, 28, 14, 14);
  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.text;
  context.font = "13px 'Segoe UI', Arial, sans-serif";
  context.fillText("CDD", width - 164, 40);
  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.sam;
  context.fillRect(width - 108, 28, 14, 14);
  context.fillStyle = APPROVAL_REPORT_CHART_COLORS.text;
  context.fillText("SAM", width - 86, 40);

  return canvas.toDataURL("image/png");
}

function appendApprovalSummarySheet(workbook, reportData) {
  const worksheet = workbook.addWorksheet(APPROVAL_SUMMARY_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  setCustomWorksheetColumns(worksheet, [
    ...APPROVAL_REPORT_SUMMARY_COLUMNS,
    { key: "spacer", width: 4 },
    { key: "chartA", width: 14 },
    { key: "chartB", width: 14 },
    { key: "chartC", width: 14 },
    { key: "chartD", width: 14 },
  ]);
  addTitleBlock(worksheet, reportData);

  appendObjectTable(
    worksheet,
    `${APPROVAL_SUMMARY_SHEET_NAME} Summary`,
    "A8",
    APPROVAL_REPORT_SUMMARY_COLUMNS,
    reportData.summaryRows,
    "TableStyleLight1",
  );
  applyCountNumberFormat(worksheet, ["B", "C", "D"]);

  const chartBase64 = createApprovalReportChartBase64(reportData);
  if (chartBase64) {
    const imageId = workbook.addImage({
      base64: chartBase64,
      extension: "png",
    });
    worksheet.addImage(imageId, {
      tl: { col: 5.1, row: 1.2 },
      ext: { width: 520, height: 280 },
    });
  }
}

function appendApprovalMonthlySheet(workbook, reportData) {
  const worksheet = workbook.addWorksheet(APPROVAL_MONTHLY_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  setCustomWorksheetColumns(worksheet, APPROVAL_REPORT_MONTHLY_COLUMNS);
  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value =
    `${reportData.currentYear} monthly PDF approval totals`;
  worksheet.getCell("A1").font = {
    bold: true,
    size: 14,
    color: { argb: "FF132635" },
  };

  worksheet.mergeCells("A2:D2");
  worksheet.getCell("A2").value =
    "Month-by-month CDD and SAM totals for the current calendar year.";
  worksheet.getCell("A2").font = {
    italic: true,
    size: 10,
    color: { argb: "FF4E6474" },
  };

  appendObjectTable(
    worksheet,
    `${APPROVAL_MONTHLY_SHEET_NAME} Table`,
    "A4",
    APPROVAL_REPORT_MONTHLY_COLUMNS,
    reportData.monthlyRows,
    "TableStyleLight1",
  );
  applyCountNumberFormat(worksheet, ["B", "C", "D"]);
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

export async function exportCurrentYearApprovalReportToExcel(
  records,
  referenceDate = new Date(),
) {
  const workbookLibrary = getExcelLibrary();
  const workbook = new workbookLibrary.Workbook();
  const reportData = buildCurrentYearApprovalReportData(records, referenceDate);

  workbook.created = new Date();
  workbook.modified = new Date();

  appendApprovalSummarySheet(workbook, reportData);
  appendApprovalMonthlySheet(workbook, reportData);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `${APPROVAL_REPORT_FILE_PREFIX}-${reportData.currentYear}.xlsx`,
  );
}
