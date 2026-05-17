function getExportTimestampStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
}

function downloadExcelBuffer(buffer, fileName) {
  const blob = new Blob(
    [buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer)],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
  downloadBlobFile(blob, fileName);
}

function getExcelColumnLetter(columnNumber) {
  let current = columnNumber;
  let columnName = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    current = Math.floor((current - 1) / 26);
  }

  return columnName || "A";
}

function formatExcelDateDisplay(value) {
  const parts = toDateParts(value);
  if (!parts) return "";

  const day = String(parts.day).padStart(2, "0");
  const month = String(MONTH_LABELS[parts.month - 1] || "").toLowerCase();
  return `${day}-${month}-${parts.year}`;
}

function toExcelDateValue(value) {
  const dayNumber = toDayNumber(value);
  if (dayNumber === null) return null;

  return dayNumber - EXCEL_DATE_EPOCH_DAY_NUMBER;
}

function formatExcelDateTimeDisplay(value) {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatExcelDateDisplay(value);
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(MONTH_LABELS[parsed.getMonth()] || "").toLowerCase();
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function toDateOnly(value) {
  const parts = toDateParts(value);
  if (!parts) return null;

  return new Date(parts.year, parts.month - 1, parts.day);
}

function toDayNumber(value) {
  const parts = toDateParts(value);
  if (!parts) return null;

  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY,
  );
}

function getStartOfWeek(value, startDay = WORKING_WEEK_START_DAY) {
  const date = toDateOnly(value instanceof Date ? value : value);
  if (!date) return null;

  const normalized = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayOffset = (normalized.getDay() - startDay + 7) % 7;
  normalized.setDate(normalized.getDate() - dayOffset);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getWorkingWeekInfo(value = new Date()) {
  const date =
    value instanceof Date
      ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
      : toDateOnly(value);
  if (!date) return null;

  const year = date.getFullYear();
  const weekStart = getStartOfWeek(date, WORKING_WEEK_START_DAY);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + WORKING_WEEK_LENGTH_DAYS - 1);

  const firstWeekStart = getStartOfWeek(
    new Date(year, 0, 1),
    WORKING_WEEK_START_DAY,
  );
  const weekStartDayNumber = toDayNumber(weekStart);
  const firstWeekStartDayNumber = toDayNumber(firstWeekStart);
  const weekNumber =
    1 + Math.floor((weekStartDayNumber - firstWeekStartDayNumber) / 7);

  return {
    year,
    weekNumber,
    weekStart,
    weekEnd,
    label: `Week ${weekNumber}`,
  };
}

function getWorkingWeekInfoByNumber(year, weekNumber) {
  const normalizedYear = clampWorkingWeekYear(year);
  const normalizedWeekNumber = clampWorkingWeekNumber(
    weekNumber,
    normalizedYear,
  );
  const firstWeekStart = getStartOfWeek(
    new Date(normalizedYear, 0, 1),
    WORKING_WEEK_START_DAY,
  );
  const weekStart = new Date(firstWeekStart);
  weekStart.setDate(firstWeekStart.getDate() + (normalizedWeekNumber - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + WORKING_WEEK_LENGTH_DAYS - 1);

  return {
    year: normalizedYear,
    weekNumber: normalizedWeekNumber,
    weekStart,
    weekEnd,
    label: `Week ${normalizedWeekNumber}`,
  };
}

function getDetailedExportWeekSelection(settings = itemSettings) {
  const fallbackWeekInfo = getWorkingWeekInfo(new Date()) || {
    year: new Date().getFullYear(),
    weekNumber: 1,
  };
  const year = clampWorkingWeekYear(
    settings?.detailedExportWeekYear ?? fallbackWeekInfo.year,
  );
  const weekNumber = clampWorkingWeekNumber(
    settings?.detailedExportWeekNumber ?? fallbackWeekInfo.weekNumber,
    year,
  );

  return {
    year,
    weekNumber,
    weekInfo: getWorkingWeekInfoByNumber(year, weekNumber),
  };
}

function getStartOfIsoWeek(value) {
  const date = toDateOnly(value instanceof Date ? value : value);
  if (!date) return null;

  const normalized = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayOffset = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - dayOffset);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getIsoWeekInfo(value = new Date()) {
  const weekStart = getStartOfIsoWeek(value);
  if (!weekStart) return null;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekAnchor = new Date(weekStart);
  weekAnchor.setDate(weekStart.getDate() + 3);

  const firstWeekAnchor = new Date(weekAnchor.getFullYear(), 0, 4);
  const firstWeekStart = getStartOfIsoWeek(firstWeekAnchor);
  const weekNumber =
    1 + Math.round((weekStart - firstWeekStart) / (7 * 24 * 60 * 60 * 1000));

  return {
    year: weekAnchor.getFullYear(),
    weekNumber,
    weekStart,
    weekEnd,
    label: `Week ${weekNumber}`,
  };
}

function isDateInWeek(value, weekInfo) {
  if (!weekInfo) return false;

  const date = toDateOnly(value);
  return (
    Boolean(date) && date >= weekInfo.weekStart && date <= weekInfo.weekEnd
  );
}

function formatWeekRangeLabel(weekInfo) {
  if (!weekInfo) return "";
  return `${formatExcelDateDisplay(weekInfo.weekStart)} to ${formatExcelDateDisplay(weekInfo.weekEnd)}`;
}

function buildDetailedTaskExportRow(task, index) {
  return {
    No: index + 1,
    TaskImage: "",
    Title: task.title,
    Quantity: getTaskCategoryCountWeight(task),
    Category: task.category || "",
    Priority: normalizePriority(task.priority),
    Status: normalizeStatus(task.status),
    Sender: task.sender || "",
    EmailSubject: task.emailSubject || "",
    Description: task.description || "",
    Notes: task.notes || "",
    Created: toExcelDateValue(task.createdAt),
    Started: toExcelDateValue(task.startedAt),
    Completed: toExcelDateValue(task.completedAt),
    Received: toExcelDateValue(task.receivedAt),
    Due: toExcelDateValue(task.dueDate),
    TaskImageDataUrl: String(task.imageDataUrl || "").trim(),
    LatestUpdates: getLatestTaskUpdatesExportValue(task.id, 5),
  };
}

const DETAILED_EXPORT_ROW_HEIGHT = 50;
const DETAILED_EXPORT_COUNTER_HEADER_HEIGHT = 26;
const DETAILED_EXPORT_COUNTER_ROW_HEIGHT = 30;
const EXCEL_TABLE_BORDER_COLOR = "FF000000";

function getCategoryStatsRows() {
  return categories.map((category) => ({
    label: category.name,
    value: tasks
      .filter((task) => task.category === category.name)
      .reduce((sum, task) => sum + getTaskCategoryCountWeight(task), 0),
    color: category.color,
  }));
}

function getDetailedCounterExportRows(
  layout = getTaskSheetHeaderLayout(),
  settings = itemSettings,
) {
  const visibleCounterKeys = new Set(
    getConfiguredDetailedExportCounterKeys(settings),
  );

  return layout.headerRows
    .filter((row) => visibleCounterKeys.has(row.key))
    .map((row, index) => ({
      No: index + 1,
      Name: row.label,
      Quantity: row.value,
      Accent: row.accent,
    }));
}

function getLatestTaskUpdatesExportValue(taskId, limit = 5) {
  const latestLogs = getLogsByTaskId(taskId).slice(0, Math.max(0, limit));
  if (!latestLogs.length) return "";

  const richText = [];
  latestLogs.forEach((log, index) => {
    const stamp = formatExcelDateDisplay(log.createdAt);
    const content = String(log.content || "").trim();
    const dateLabel = stamp ? `[${stamp}]` : "[]";

    richText.push({
      font: { bold: true },
      text: `${index > 0 ? "\n" : ""}${dateLabel}`,
    });

    if (content) {
      richText.push({
        text: ` - ${content}`,
      });
    }
  });

  return { richText };
}

function getDetailedTaskExportRows(taskList = tasks) {
  return taskList.map((task, index) => buildDetailedTaskExportRow(task, index));
}

function getPendingTaskExportRows() {
  return getDetailedTaskExportRows(
    tasks.filter((task) => !isTaskCompleted(task)),
  );
}

function getWeeklyCompletedTaskRows(weekInfo) {
  const completedTasks = tasks
    .filter(
      (task) =>
        isTaskCompleted(task) && isDateInWeek(task.completedAt, weekInfo),
    )
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

  return getDetailedTaskExportRows(completedTasks);
}

function getExcelImageDescriptorFromDataUrl(dataUrl) {
  const normalized = String(dataUrl || "").trim();
  if (!/^data:image\//i.test(normalized)) return null;

  const matched = normalized.match(/^data:image\/([^;]+);base64,(.+)$/i);
  if (!matched) return null;

  const extension =
    String(matched[1] || "").toLowerCase() === "svg+xml"
      ? "png"
      : String(matched[1] || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
  const base64 = String(matched[2] || "").trim();
  if (!base64) return null;

  return {
    extension: extension || "jpeg",
    base64,
  };
}

function safeAddConditionalFormatting(worksheet, ref, rules) {
  if (typeof worksheet.addConditionalFormatting !== "function") return;

  try {
    worksheet.addConditionalFormatting({ ref, rules });
  } catch {
    // Ignore conditional-formatting support issues in older ExcelJS builds.
  }
}

function buildValidationListSheet(workbook) {
  const worksheet = workbook.addWorksheet("Lists");
  worksheet.state = "veryHidden";

  const listGroups = [
    {
      title: "Categories",
      values: categories.map((category) => category.name),
    },
    { title: "Priorities", values: PRIORITY_OPTIONS },
    { title: "Statuses", values: STATUS_OPTIONS },
    { title: "Senders", values: getSenderOptions() },
  ];

  listGroups.forEach((group, index) => {
    const columnNumber = index + 1;
    const headerCell = worksheet.getCell(1, columnNumber);
    headerCell.value = group.title;
    group.values.forEach((value, valueIndex) => {
      worksheet.getCell(valueIndex + 2, columnNumber).value = value;
    });
    worksheet.getColumn(columnNumber).width = Math.max(
      group.title.length + 2,
      ...group.values.map((value) => String(value).length + 2),
      12,
    );
  });

  return {
    categories: `'Lists'!$A$2:$A$${Math.max(categories.length + 1, 2)}`,
    priorities: `'Lists'!$B$2:$B$${Math.max(PRIORITY_OPTIONS.length + 1, 2)}`,
    statuses: `'Lists'!$C$2:$C$${Math.max(STATUS_OPTIONS.length + 1, 2)}`,
    senders: `'Lists'!$D$2:$D$${Math.max(getSenderOptions().length + 1, 2)}`,
  };
}

function applyListValidation(
  worksheet,
  columnLetter,
  startRow,
  endRow,
  formula,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    worksheet.getCell(`${columnLetter}${rowNumber}`).dataValidation = {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid value",
      error: "Choose a value from the existing Task Manager options.",
      formulae: [formula],
    };
  }
}

function normalizeExcelHexColor(value, fallback = "64748B") {
  const matched = String(value || "")
    .trim()
    .match(/^#?([0-9a-fA-F]{6})$/);
  return matched ? matched[1].toUpperCase() : fallback;
}

function blendExcelHexColors(base, mixWith = "FFFFFF", mixRatio = 0.84) {
  const baseHex = normalizeExcelHexColor(base);
  const mixHex = normalizeExcelHexColor(mixWith, "FFFFFF");
  const ratio = Math.max(0, Math.min(1, mixRatio));
  const channels = [0, 2, 4].map((offset) => {
    const baseChannel = Number.parseInt(baseHex.slice(offset, offset + 2), 16);
    const mixChannel = Number.parseInt(mixHex.slice(offset, offset + 2), 16);
    const value = Math.round(baseChannel * (1 - ratio) + mixChannel * ratio);
    return value.toString(16).padStart(2, "0").toUpperCase();
  });

  return channels.join("");
}

function getExcelTextRuleFormula(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getWorksheetColumnLetter(columns, key) {
  const columnIndex = columns.findIndex((column) => column.key === key);
  return columnIndex === -1 ? "" : getExcelColumnLetter(columnIndex + 1);
}

function applySharedTaskSheetValidationAndFormatting(
  worksheet,
  rows,
  columns,
  context,
  validationLists,
) {
  const startRow = context.tableStartRow + 1;
  const endRow = Math.max(rows.length + context.tableStartRow, startRow);
  const categoryColumnLetter = getWorksheetColumnLetter(columns, "Category");
  const priorityColumnLetter = getWorksheetColumnLetter(columns, "Priority");
  const senderColumnLetter = getWorksheetColumnLetter(columns, "Sender");
  const statusColumnLetter = getWorksheetColumnLetter(columns, "Status");
  const quantityColumnLetter = getWorksheetColumnLetter(columns, "Quantity");

  if (categoryColumnLetter) {
    applyListValidation(
      worksheet,
      categoryColumnLetter,
      startRow,
      endRow,
      validationLists.categories,
    );
  }
  if (priorityColumnLetter) {
    applyListValidation(
      worksheet,
      priorityColumnLetter,
      startRow,
      endRow,
      validationLists.priorities,
    );
  }
  if (senderColumnLetter) {
    applyListValidation(
      worksheet,
      senderColumnLetter,
      startRow,
      endRow,
      validationLists.senders,
    );
  }
  if (statusColumnLetter) {
    applyListValidation(
      worksheet,
      statusColumnLetter,
      startRow,
      endRow,
      validationLists.statuses,
    );
  }

  if (priorityColumnLetter) {
    safeAddConditionalFormatting(
      worksheet,
      `${priorityColumnLetter}${startRow}:${priorityColumnLetter}${endRow}`,
      [
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Critical"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFFF1F2" },
              fgColor: { argb: "FFFFF1F2" },
            },
            font: { color: { argb: "FF991B1B" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"High"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFFF7ED" },
              fgColor: { argb: "FFFFF7ED" },
            },
            font: { color: { argb: "FF9A3412" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Medium"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFFFBEB" },
              fgColor: { argb: "FFFFFBEB" },
            },
            font: { color: { argb: "FFB45309" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Low"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFF2FBF5" },
              fgColor: { argb: "FFF2FBF5" },
            },
            font: { color: { argb: "FF15803D" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Very Low"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFF1F9FE" },
              fgColor: { argb: "FFF1F9FE" },
            },
            font: { color: { argb: "FF0369A1" }, bold: true },
          },
        },
      ],
    );
  }

  if (statusColumnLetter) {
    safeAddConditionalFormatting(
      worksheet,
      `${statusColumnLetter}${startRow}:${statusColumnLetter}${endRow}`,
      [
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Pending"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFFFBEB" },
              fgColor: { argb: "FFFFFBEB" },
            },
            font: { color: { argb: "FFB45309" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Not Started"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFF8FAFC" },
              fgColor: { argb: "FFF8FAFC" },
            },
            font: { color: { argb: "FF475569" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Ongoing"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFF2F7FF" },
              fgColor: { argb: "FFF2F7FF" },
            },
            font: { color: { argb: "FF1D4ED8" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Waiting for Someone Else"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFFFF5F0" },
              fgColor: { argb: "FFFFF5F0" },
            },
            font: { color: { argb: "FF9A3412" }, bold: true },
          },
        },
        {
          type: "cellIs",
          operator: "equal",
          formulae: ['"Completed"'],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFF1FBF4" },
              fgColor: { argb: "FFF1FBF4" },
            },
            font: { color: { argb: "FF166534" }, bold: true },
          },
        },
      ],
    );
  }

  if (quantityColumnLetter) {
    safeAddConditionalFormatting(
      worksheet,
      `${quantityColumnLetter}${startRow}:${quantityColumnLetter}${endRow}`,
      [
        {
          type: "cellIs",
          operator: "greaterThan",
          formulae: ["1"],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: { argb: "FFF2FBF7" },
              fgColor: { argb: "FFF2FBF7" },
            },
            font: { color: { argb: "FF115E59" }, bold: true },
          },
        },
      ],
    );
  }

  if (categoryColumnLetter && categories.length) {
    safeAddConditionalFormatting(
      worksheet,
      `${categoryColumnLetter}${startRow}:${categoryColumnLetter}${endRow}`,
      categories.map((category) => {
        const accent = normalizeExcelHexColor(category.color);
        return {
          type: "cellIs",
          operator: "equal",
          formulae: [getExcelTextRuleFormula(category.name)],
          style: {
            fill: {
              type: "pattern",
              pattern: "solid",
              bgColor: {
                argb: `FF${blendExcelHexColors(accent, "FFFFFF", 0.9)}`,
              },
              fgColor: {
                argb: `FF${blendExcelHexColors(accent, "FFFFFF", 0.9)}`,
              },
            },
            font: { color: { argb: `FF${accent}` }, bold: true },
          },
        };
      }),
    );
  }

  return { startRow, endRow };
}

function applyTaskSheetImages(worksheet, rows, imageColumnLetter, startRow) {
  if (!imageColumnLetter) return;

  rows.forEach((row, index) => {
    const imageDescriptor = getExcelImageDescriptorFromDataUrl(
      row.TaskImageDataUrl,
    );
    if (!imageDescriptor) return;

    const rowNumber = startRow + index;
    const imageId = worksheet.workbook.addImage(imageDescriptor);
    worksheet.addImage(imageId, {
      tl: { col: 1 + 0.18, row: rowNumber - 1 + 0.05 },
      ext: { width: 98, height: 98 },
      editAs: "oneCell",
    });
    worksheet.getCell(`${imageColumnLetter}${rowNumber}`).value = "";
  });
}

function applyCompletedTaskRowFormatting(worksheet, rows, columns, context) {
  const completedStatus = "Completed";
  const preservedColumnKeys = new Set([
    "Category",
    "Priority",
    "Status",
    "Quantity",
  ]);
  const completedFill = "FFF3F4F6";
  const completedFont = "FF6B7280";

  rows.forEach((row, index) => {
    if (normalizeStatus(row?.Status) !== completedStatus) return;

    const worksheetRow = worksheet.getRow(context.tableStartRow + 1 + index);
    columns.forEach((column, columnIndex) => {
      if (preservedColumnKeys.has(column.key)) return;

      const cell = worksheetRow.getCell(columnIndex + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: completedFill },
      };
      cell.font = {
        ...(cell.font || {}),
        color: { argb: completedFont },
      };
    });
  });
}

function getTaskSheetHeaderLayout() {
  const openTasks = tasks.filter((task) => !isTaskCompleted(task));
  const headerRows = [
    {
      key: "openTasks",
      label: "Open Tasks",
      value: openTasks.length,
      accent: "1D4ED8",
    },
    {
      key: "ongoing",
      label: "Ongoing",
      value: openTasks.filter(
        (task) => normalizeStatus(task.status) === "Ongoing",
      ).length,
      accent: "1D4ED8",
    },
    {
      key: "overdue",
      label: "Overdue",
      value: openTasks.filter((task) => isOverdue(task.dueDate)).length,
      accent: "DC2626",
    },
    ...categories.map((category) => ({
      key: getDetailedExportCategoryCounterKey(category.name),
      label: category.name,
      value: openTasks
        .filter((task) => task.category === category.name)
        .reduce((sum, task) => sum + getTaskCategoryCountWeight(task), 0),
      accent: normalizeExcelHexColor(category.color),
    })),
  ];

  return {
    headerRows,
    tableHeaderRow: 3,
    firstDataRow: 4,
    tableStartRow: 4 + headerRows.length,
  };
}

function buildTaskSheetDashboardHeader(
  worksheet,
  lastColumn,
  layout = getTaskSheetHeaderLayout(),
) {
  const headerFill = "FFF8FAFC";
  const headerBorder = EXCEL_TABLE_BORDER_COLOR;
  const numberHeaderCell = worksheet.getCell(`A${layout.tableHeaderRow}`);
  const nameHeaderCell = worksheet.getCell(`B${layout.tableHeaderRow}`);
  const quantityHeaderCell = worksheet.getCell(`C${layout.tableHeaderRow}`);

  numberHeaderCell.value = "No.";
  nameHeaderCell.value = "Name";
  quantityHeaderCell.value = "Quantity";
  [numberHeaderCell, nameHeaderCell, quantityHeaderCell].forEach((cell) => {
    cell.font = { size: 12, bold: true, color: { argb: "FF0F172A" } };
    cell.alignment = {
      vertical: "middle",
      horizontal: cell.col === 2 ? "left" : "center",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerFill },
    };
    cell.border = {
      top: { style: "thin", color: { argb: headerBorder } },
      left: { style: "thin", color: { argb: headerBorder } },
      bottom: { style: "thin", color: { argb: headerBorder } },
      right: { style: "thin", color: { argb: headerBorder } },
    };
  });

  layout.headerRows.forEach((row, index) => {
    const rowNumber = layout.firstDataRow + index;
    const accent = normalizeExcelHexColor(row.accent);
    const numberCell = worksheet.getCell(`A${rowNumber}`);
    const labelCell = worksheet.getCell(`B${rowNumber}`);
    const valueCell = worksheet.getCell(`C${rowNumber}`);

    numberCell.value = index + 1;
    labelCell.value = row.label;
    valueCell.value = row.value;

    [numberCell, labelCell, valueCell].forEach((cell) => {
      cell.font = { size: 13, bold: true, color: { argb: `FF${accent}` } };
      cell.alignment = {
        vertical: "middle",
        horizontal: cell.col === 2 ? "left" : "center",
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${blendExcelHexColors(accent, "FFFFFF", 0.92)}` },
      };
      cell.border = {
        top: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
        left: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
        bottom: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
        right: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
      };
    });
  });

  worksheet.getRow(layout.tableHeaderRow).height =
    DETAILED_EXPORT_COUNTER_HEADER_HEIGHT;
  for (
    let rowNumber = layout.firstDataRow;
    rowNumber < layout.tableStartRow;
    rowNumber += 1
  ) {
    worksheet.getRow(rowNumber).height = DETAILED_EXPORT_COUNTER_ROW_HEIGHT;
  }
}

function styleDetailedWorksheet(worksheet, columns, rows, options = {}) {
  const accentColor = options.accentColor || "2563EB";
  const title = options.title || worksheet.name;
  const subtitle = options.subtitle || "";
  const titleFontSize = options.titleFontSize || 16;
  const subtitleFontSize = options.subtitleFontSize || 10;
  const lastColumn = getExcelColumnLetter(columns.length);
  const tableStartRow = options.tableStartRow || 4;
  const dateColumnKeys = new Set(options.dateColumns || []);
  const tableGridColor = options.tableGridColor || EXCEL_TABLE_BORDER_COLOR;
  const rowHeights = options.rowHeights || {};
  const defaultRowHeight =
    rowHeights.default ?? rowHeights.body ?? DETAILED_EXPORT_ROW_HEIGHT;
  const preTableRowHeight = rowHeights.preTable ?? defaultRowHeight;
  const headerRowHeight = rowHeights.header ?? defaultRowHeight;
  const bodyRowHeight = rowHeights.body ?? defaultRowHeight;
  const emptyRowHeight = rowHeights.empty ?? bodyRowHeight;

  worksheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width || 18,
  }));
  worksheet.properties.defaultRowHeight = defaultRowHeight;
  worksheet.views = [
    { state: "frozen", ySplit: tableStartRow, showGridLines: true },
  ];
  worksheet.pageSetup = { ...(worksheet.pageSetup || {}), showGridLines: true };

  worksheet.mergeCells(`A1:${lastColumn}1`);
  worksheet.mergeCells(`A2:${lastColumn}2`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A2").value = subtitle;
  worksheet.getCell("A1").font = {
    size: titleFontSize,
    bold: true,
    color: { argb: "FF0F172A" },
  };
  worksheet.getCell("A2").font = {
    size: subtitleFontSize,
    color: { argb: "FF475569" },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheet.getCell("A2").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  for (let rowNumber = 1; rowNumber < tableStartRow; rowNumber += 1) {
    worksheet.getRow(rowNumber).height = preTableRowHeight;
  }

  if (typeof options.beforeTable === "function") {
    options.beforeTable(worksheet, columns, { lastColumn, tableStartRow });
  }

  const headerRow = worksheet.getRow(tableStartRow);
  worksheet.autoFilter = {
    from: { row: tableStartRow, column: 1 },
    to: { row: tableStartRow, column: columns.length },
  };
  columns.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header;
  });
  headerRow.height = headerRowHeight;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: `FF${accentColor}` } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${blendExcelHexColors(accentColor, "FFFFFF", 0.9)}` },
    };
    cell.border = {
      top: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
      left: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
      right: { style: "thin", color: { argb: EXCEL_TABLE_BORDER_COLOR } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
  });

  rows.forEach((row, index) => {
    const worksheetRow = worksheet.getRow(tableStartRow + 1 + index);
    columns.forEach((column, columnIndex) => {
      const cell = worksheetRow.getCell(columnIndex + 1);
      cell.value = row[column.key] ?? "";
      if (
        dateColumnKeys.has(column.key) &&
        (cell.value instanceof Date || typeof cell.value === "number")
      ) {
        cell.numFmt = "d-mmm-yy";
      }
    });
    worksheetRow.height = bodyRowHeight;
    worksheetRow.eachCell((cell) => {
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: options.centerColumns?.includes(cell.col)
          ? "center"
          : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: tableGridColor } },
        left: { style: "thin", color: { argb: tableGridColor } },
        bottom: { style: "thin", color: { argb: tableGridColor } },
        right: { style: "thin", color: { argb: tableGridColor } },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFFCFDFE" },
      };
    });
  });

  if (!rows.length) {
    const emptyRow = worksheet.getRow(tableStartRow + 1);
    emptyRow.getCell(1).value = options.emptyMessage || "No records available.";
    emptyRow.height = emptyRowHeight;
    emptyRow.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
  }

  if (typeof options.afterBuild === "function") {
    options.afterBuild(worksheet, rows, columns, { tableStartRow });
  }
}

async function exportDetailedToExcel() {
  if (typeof ExcelJS === "undefined") {
    alert(
      "Detailed Excel export is unavailable because the ExcelJS library did not load. Reload the page and try again.",
    );
    return;
  }

  if (
    !confirm(
      `Create a detailed Excel workbook for ${tasks.length} task${tasks.length === 1 ? "" : "s"}?`,
    )
  ) {
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const stamp = getExportTimestampStamp();
    workbook.creator = "GitHub Copilot";
    workbook.lastModifiedBy = "GitHub Copilot";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.company = "FolderStandards";
    workbook.subject = "Task Manager Detailed Export";
    workbook.title = `Task Manager Detailed Export ${stamp}`;

    const validationLists = buildValidationListSheet(workbook);
    const selectedWeek = getDetailedExportWeekSelection();
    const currentWeekInfo = selectedWeek.weekInfo;
    const weekSubtitle = `${currentWeekInfo.label} of ${currentWeekInfo.year} (${formatWeekRangeLabel(currentWeekInfo)}; Sunday to Thursday working week)`;
    const taskColumns = getConfiguredDetailedExportColumns();
    const taskCenterColumns = getDetailedExportCenterColumns(taskColumns);
    const taskDateColumns = getDetailedExportDateColumnKeys(taskColumns);
    const taskImageColumnKey = getDetailedExportImageColumnKey(taskColumns);
    const taskRows = getDetailedTaskExportRows();
    const pendingRows = getPendingTaskExportRows();
    const taskHeaderLayout = getTaskSheetHeaderLayout();
    const counterRows = getDetailedCounterExportRows(taskHeaderLayout);
    const weeklyCompletedRows = getWeeklyCompletedTaskRows(currentWeekInfo);
    const counterColumns = [
      { key: "No", header: "No.", width: 8 },
      { key: "Name", header: "Counter", width: 34 },
      { key: "Quantity", header: "Quantity", width: 14 },
    ];

    styleDetailedWorksheet(
      workbook.addWorksheet("Counters"),
      counterColumns,
      counterRows,
      {
        title: "Task Counters",
        subtitle: `Exported ${formatExcelDateTimeDisplay(new Date().toISOString())}. Counters on this sheet reflect open work only and follow the counter visibility chosen in Settings.`,
        accentColor: "1D4ED8",
        emptyMessage: "No counters available.",
        centerColumns: [1, 3],
        rowHeights: {
          default: 30,
          preTable: 30,
          header: 30,
          body: 30,
          empty: 30,
        },
        afterBuild: (worksheet, rows, columns, context) => {
          rows.forEach((row, index) => {
            const accent = normalizeExcelHexColor(row.Accent);
            const rowNumber = context.tableStartRow + 1 + index;
            const worksheetRow = worksheet.getRow(rowNumber);

            worksheetRow.eachCell((cell) => {
              cell.font = {
                size: 13,
                bold: true,
                color: { argb: `FF${accent}` },
              };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                  argb: `FF${blendExcelHexColors(accent, "FFFFFF", 0.92)}`,
                },
              };
              cell.border = {
                top: {
                  style: "thin",
                  color: { argb: EXCEL_TABLE_BORDER_COLOR },
                },
                left: {
                  style: "thin",
                  color: { argb: EXCEL_TABLE_BORDER_COLOR },
                },
                bottom: {
                  style: "thin",
                  color: { argb: EXCEL_TABLE_BORDER_COLOR },
                },
                right: {
                  style: "thin",
                  color: { argb: EXCEL_TABLE_BORDER_COLOR },
                },
              };
            });
          });
        },
      },
    );

    styleDetailedWorksheet(
      workbook.addWorksheet("All Tasks"),
      taskColumns,
      taskRows,
      {
        title: "All Tasks",
        subtitle: `Exported ${formatExcelDateTimeDisplay(new Date().toISOString())}. Summary counters were moved to the Counters sheet; this sheet keeps the detailed task table only.`,
        accentColor: "1D4ED8",
        emptyMessage: "No tasks available.",
        centerColumns: taskCenterColumns,
        dateColumns: taskDateColumns,
        rowHeights: {
          default: 80,
          preTable: 30,
          header: 50,
          body: 80,
          empty: 80,
        },
        afterBuild: (worksheet, rows, columns, context) => {
          const imageColumnLetter = getWorksheetColumnLetter(
            columns,
            taskImageColumnKey,
          );
          applyCompletedTaskRowFormatting(worksheet, rows, columns, context);
          const { startRow } = applySharedTaskSheetValidationAndFormatting(
            worksheet,
            rows,
            columns,
            context,
            validationLists,
          );
          applyTaskSheetImages(worksheet, rows, imageColumnLetter, startRow);
        },
      },
    );

    styleDetailedWorksheet(
      workbook.addWorksheet("Pending List"),
      taskColumns,
      pendingRows,
      {
        title: "Pending List",
        subtitle: `Exported ${formatExcelDateTimeDisplay(new Date().toISOString())}. This sheet includes every task that is not completed.`,
        accentColor: "D97706",
        emptyMessage: "No pending tasks available.",
        centerColumns: taskCenterColumns,
        dateColumns: taskDateColumns,
        rowHeights: {
          default: 80,
          preTable: 30,
          header: 50,
          body: 80,
          empty: 80,
        },
        afterBuild: (worksheet, rows, columns, context) => {
          const imageColumnLetter = getWorksheetColumnLetter(
            columns,
            taskImageColumnKey,
          );
          applyCompletedTaskRowFormatting(worksheet, rows, columns, context);
          const { startRow } = applySharedTaskSheetValidationAndFormatting(
            worksheet,
            rows,
            columns,
            context,
            validationLists,
          );
          applyTaskSheetImages(worksheet, rows, imageColumnLetter, startRow);
        },
      },
    );

    styleDetailedWorksheet(
      workbook.addWorksheet("Weekly Completed"),
      taskColumns,
      weeklyCompletedRows,
      {
        title: `${currentWeekInfo.label} Completed Tasks`,
        subtitle: `${weekSubtitle}.`,
        titleFontSize: 24,
        subtitleFontSize: 11,
        accentColor: "16A34A",
        emptyMessage: `No tasks were completed during ${currentWeekInfo.label} (${formatWeekRangeLabel(currentWeekInfo)}).`,
        centerColumns: taskCenterColumns,
        dateColumns: taskDateColumns,
        rowHeights: {
          default: 80,
          preTable: 40,
          header: 50,
          body: 80,
          empty: 80,
        },
        afterBuild: (worksheet, rows, columns, context) => {
          const imageColumnLetter = getWorksheetColumnLetter(
            columns,
            taskImageColumnKey,
          );
          applyCompletedTaskRowFormatting(worksheet, rows, columns, context);
          const { startRow } = applySharedTaskSheetValidationAndFormatting(
            worksheet,
            rows,
            columns,
            context,
            validationLists,
          );
          applyTaskSheetImages(worksheet, rows, imageColumnLetter, startRow);
        },
      },
    );

    const buffer = await workbook.xlsx.writeBuffer();
    downloadExcelBuffer(buffer, `task-manager-detailed-export-${stamp}.xlsx`);
  } catch (error) {
    alert(error?.message || "Detailed Excel export failed.");
  }
}
