export const APPROVAL_TYPES = {
  CDD: "Counter Die Drawing",
  SAM: "Sample",
};

export const APPROVAL_FILTERS = {
  ALL: "all",
  CDD: "cdd",
  SAM: "sam",
};

export const ITEM_TYPE_FILTERS = {
  ALL: "all",
};

export const PERIOD_FILTERS = {
  YEARLY: "yearly",
  MONTHLY: "monthly",
  WEEKLY: "weekly",
};

export const STATUS_FILTERS = {
  ALL: "all",
  UNCLASSIFIED: "unclassified",
};

const RECENT_BUCKET_LIMITS = {
  [PERIOD_FILTERS.YEARLY]: 6,
  [PERIOD_FILTERS.MONTHLY]: 12,
  [PERIOD_FILTERS.WEEKLY]: 16,
};

const APPROVAL_TYPE_LABELS = new Map([
  [APPROVAL_TYPES.CDD, "CDD"],
  [APPROVAL_TYPES.SAM, "SAM"],
]);

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const DEFAULT_APPROVAL_DASHBOARD_FILTERS = {
  itemType: ITEM_TYPE_FILTERS.ALL,
  period: PERIOD_FILTERS.MONTHLY,
  approvalType: APPROVAL_FILTERS.ALL,
  approvalStatus: STATUS_FILTERS.ALL,
  includeRevisions: true,
  showRecentOnly: true,
};

function normalizeFilters(filters = {}) {
  return {
    ...DEFAULT_APPROVAL_DASHBOARD_FILTERS,
    ...filters,
  };
}

function getApprovalKey(record) {
  if (record.approvalType === APPROVAL_TYPES.CDD) {
    return APPROVAL_FILTERS.CDD;
  }

  if (record.approvalType === APPROVAL_TYPES.SAM) {
    return APPROVAL_FILTERS.SAM;
  }

  return null;
}

function isApprovalRecord(record) {
  return Boolean(getApprovalKey(record));
}

function isPdfApprovalRecord(record) {
  return isApprovalRecord(record) && record.fileType === "pdf";
}

function getRecentBucketLimit(period) {
  return (
    RECENT_BUCKET_LIMITS[period] ?? RECENT_BUCKET_LIMITS[PERIOD_FILTERS.MONTHLY]
  );
}

function hasBaseRevision(record) {
  const value = String(record.revision ?? "")
    .trim()
    .toUpperCase();
  return value === "" || value === "0" || value === "R0" || value === "REV0";
}

function parseIsoDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getIsoWeekInfo(date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  const weekYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstThursdayDayNumber = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() + 4 - firstThursdayDayNumber,
  );

  const weekNumber = Math.ceil(
    ((target.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7,
  );

  return { weekYear, weekNumber };
}

function getPeriodBucket(date, period) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  if (period === PERIOD_FILTERS.YEARLY) {
    return {
      key: String(year),
      label: String(year),
      sortValue: year * 10000,
    };
  }

  if (period === PERIOD_FILTERS.WEEKLY) {
    const { weekYear, weekNumber } = getIsoWeekInfo(date);
    return {
      key: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
      label: `W${weekNumber} ${weekYear}`,
      sortValue: weekYear * 100 + weekNumber,
    };
  }

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    label: `${MONTH_LABELS[month]} ${year}`,
    sortValue: year * 100 + month,
  };
}

function matchesItemType(record, itemType) {
  return itemType === ITEM_TYPE_FILTERS.ALL || record.itemType === itemType;
}

function matchesApprovalType(record, approvalType) {
  return (
    approvalType === APPROVAL_FILTERS.ALL ||
    getApprovalKey(record) === approvalType
  );
}

function matchesApprovalStatus(record, approvalStatus) {
  if (approvalStatus === STATUS_FILTERS.ALL) {
    return true;
  }

  if (approvalStatus === STATUS_FILTERS.UNCLASSIFIED) {
    return !record.approvalStatus;
  }

  return record.approvalStatus === approvalStatus;
}

function incrementCounter(counter, key) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function toSortedCounterList(counter) {
  return Array.from(counter.entries())
    .map(([label, count]) => ({ label, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    );
}

function createBucket(bucketInfo) {
  return {
    ...bucketInfo,
    cdd: 0,
    sam: 0,
    total: 0,
  };
}

export function aggregateApprovalRecords(records, filters = {}) {
  const normalizedFilters = normalizeFilters(filters);
  const buckets = new Map();
  const statusCounts = new Map();
  const itemTypeCounts = new Map();
  let cddCount = 0;
  let samCount = 0;
  let revisionCount = 0;
  let excludedRevisionCount = 0;
  let excludedNonPdfCount = 0;
  let undatedCount = 0;

  const approvalCandidates = records.filter(isApprovalRecord);
  const filteredRecords = [];

  for (const record of approvalCandidates) {
    if (!matchesItemType(record, normalizedFilters.itemType)) {
      continue;
    }

    if (!matchesApprovalType(record, normalizedFilters.approvalType)) {
      continue;
    }

    if (!matchesApprovalStatus(record, normalizedFilters.approvalStatus)) {
      continue;
    }

    if (!isPdfApprovalRecord(record)) {
      excludedNonPdfCount += 1;
      continue;
    }

    const isRevision = !hasBaseRevision(record);
    if (isRevision) {
      revisionCount += 1;
    }

    if (!normalizedFilters.includeRevisions && isRevision) {
      excludedRevisionCount += 1;
      continue;
    }

    const approvalKey = getApprovalKey(record);
    const approvalLabel =
      APPROVAL_TYPE_LABELS.get(record.approvalType) ?? "Other";
    const statusLabel = record.approvalStatus || "Unclassified";
    filteredRecords.push(record);
    incrementCounter(statusCounts, statusLabel);
    incrementCounter(itemTypeCounts, record.itemType || "Unclassified");

    if (approvalKey === APPROVAL_FILTERS.CDD) {
      cddCount += 1;
    }

    if (approvalKey === APPROVAL_FILTERS.SAM) {
      samCount += 1;
    }

    const date = parseIsoDate(record.date);
    if (!date) {
      undatedCount += 1;
      continue;
    }

    const bucketInfo = getPeriodBucket(date, normalizedFilters.period);
    const bucket = buckets.get(bucketInfo.key) ?? createBucket(bucketInfo);
    bucket.total += 1;
    bucket[approvalKey] += 1;
    bucket.approvalLabel = approvalLabel;
    buckets.set(bucketInfo.key, bucket);
  }

  const timeline = Array.from(buckets.values()).sort(
    (left, right) => left.sortValue - right.sortValue,
  );
  const fullTimelineCount = timeline.reduce(
    (sum, bucket) => sum + bucket.total,
    0,
  );
  const visibleTimeline = normalizedFilters.showRecentOnly
    ? timeline.slice(-getRecentBucketLimit(normalizedFilters.period))
    : timeline;
  const plottedCount = visibleTimeline.reduce(
    (sum, bucket) => sum + bucket.total,
    0,
  );

  return {
    filters: normalizedFilters,
    totalApprovalRecords: approvalCandidates.length,
    filteredRecords,
    timeline: visibleTimeline,
    totals: {
      all: filteredRecords.length,
      cdd: cddCount,
      sam: samCount,
      dated: filteredRecords.length - undatedCount,
      undated: undatedCount,
      plotted: plottedCount,
      hiddenOlderDated: Math.max(0, fullTimelineCount - plottedCount),
      revisions: revisionCount,
      excludedRevisions: excludedRevisionCount,
      excludedNonPdf: excludedNonPdfCount,
    },
    breakdowns: {
      status: toSortedCounterList(statusCounts),
      itemType: toSortedCounterList(itemTypeCounts),
    },
    window: {
      showRecentOnly: normalizedFilters.showRecentOnly,
      bucketLimit: getRecentBucketLimit(normalizedFilters.period),
      visibleBucketCount: visibleTimeline.length,
      hiddenBucketCount: Math.max(0, timeline.length - visibleTimeline.length),
    },
  };
}
