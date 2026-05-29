import { SUPPLIER_ALIAS_GROUPS, SUPPLIERS, SYSTEMS } from "./constants.js";

const APPROVAL_TYPES = {
  D: "Counter Die Drawing",
  S: "Sample",
};

const DATE_VALIDATION_STATUS = {
  MISSING: "missing",
  VALID: "valid",
  REORDERED: "reordered",
  FUTURE: "future",
  INVALID: "invalid",
};

const TRAILING_DATE_PATTERN =
  /(?:^|[.\s-])(?<value>\d{4}-\d{2}-\d{2}|\d{2}[.\-/]\d{2}(?:[.\-/,\s])\d{2})(?:[\s._-]+[A-Z][A-Z0-9\s._-]*)?\s*$/i;
const TRAILING_REVISION_PATTERN =
  /(?:^|[\s-])(?<value>P\d+|R\d+|REV(?:ISION)?[\s-]*[A-Z0-9]+)\s*$/i;
const GROUPED_REVISION_PATTERN = /[\[(](?<prefix>R)\s*(?<number>\d+)[\])]/i;
const INLINE_REVISION_PATTERN = /[\s._-](?<value>R\s*\d+)(?=$|[\s._-])/i;
const COMPACT_APPROVAL_SUFFIX_PATTERN =
  /^(?<reference>[A-Z0-9-]*\d[A-Z0-9-]*)(?<approval>(?:S(?:AM|AMPLE)?|D)(?:$|[.\s-].*))$/i;

const PROJECTS_ROOT = "PROJECTS EXTRUDERS";
const WICONA_PROJECTS_FOLDER = "WICONA PROJECTS";
const WICONA_PROJECTS_FOLDER_ALIASES = new Set([
  normalizeCode(WICONA_PROJECTS_FOLDER),
  "WICONA PROJECT",
]);

const INVALID_REFERENCE_WORDS = new Set([
  "APP",
  "APPD",
  "APPROVED",
  "APD",
  "APPR",
  "APPRD",
  "APRD",
  "CDD",
  "COMM",
  "COMMENT",
  "COMMENTS",
  "D",
  "DIE",
  "DRAWING",
  "DRG",
  "FINAL",
  "FIN",
  "REJ",
  "REJECTED",
  "S",
  "SAM",
  "SAMPLE",
  "WC",
]);

const GENERIC_SUPPLIER_SEGMENTS = new Set([
  PROJECTS_ROOT,
  WICONA_PROJECTS_FOLDER,
  "FINAL DRAWINGS OR RECORD",
  "FINAL COUNTER DIE DRAWINGS COMMON",
  "PRELIMINARY CAD DIE DRWG",
  "PDF DATA BASE",
  "PENDING SAMPLES",
  "SAMPLES",
  "SAMPLE",
  "DATA",
]);

/**
 * One parsed record is created for every non-empty input line.
 * Unknown fields stay null so the parser does not invent metadata.
 *
 * @typedef {Object} FileAnalysisRecord
 * @property {string} fileName
 * @property {string} path
 * @property {string | null} project
 * @property {string | null} supplier
 * @property {string | null} system
 * @property {string | null} referenceNumber
 * @property {string | null} dieNumber
 * @property {string | null} approvalChunk
 * @property {string | null} approvalType
 * @property {string | null} approvalRuleKey
 * @property {boolean} approvalPatternUnmatched
 * @property {string | null} approvalStatus
 * @property {string | null} itemType
 * @property {string | null} rawDate
 * @property {string | null} date
 * @property {string} dateValidationStatus
 * @property {boolean} dateWasReordered
 * @property {boolean} dateIsFuture
 * @property {string | null} revision
 * @property {string | null} fileType
 * @property {string | null} validationNotes
 * @property {boolean} fcdd
 */

function cleanText(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePath(rawPath) {
  return cleanText(rawPath).replace(/\//g, "\\");
}

function normalizeCode(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function trimTokenSeparators(value) {
  return cleanText(value).replace(/^[\s.,;:_-]+|[\s.,;:_-]+$/g, "");
}

const CANONICAL_SUPPLIERS = new Set([
  ...SUPPLIERS,
  ...SUPPLIER_ALIAS_GROUPS.keys(),
]);

const SUPPLIER_LOOKUP = new Map(
  Array.from(CANONICAL_SUPPLIERS, (supplier) => [
    normalizeCode(supplier),
    supplier,
  ]),
);

const SUPPLIER_ALIAS_LOOKUP = new Map(
  Array.from(SUPPLIER_ALIAS_GROUPS.entries()).flatMap(([supplier, aliases]) =>
    aliases.map((alias) => [normalizeCode(alias), supplier]),
  ),
);

const SUPPLIER_FUZZY_CANDIDATES = [
  ...Array.from(CANONICAL_SUPPLIERS, (supplier) => ({
    supplier,
    normalizedValue: normalizeCode(supplier),
  })),
  ...Array.from(SUPPLIER_ALIAS_GROUPS.entries()).flatMap(
    ([supplier, aliases]) =>
      aliases.map((alias) => ({
        supplier,
        normalizedValue: normalizeCode(alias),
      })),
  ),
];

const SUPPLIER_SEGMENT_CANDIDATES = Array.from(
  new Map(
    [
      ...Array.from(CANONICAL_SUPPLIERS, (supplier) => [supplier, supplier]),
      ...Array.from(SUPPLIER_ALIAS_GROUPS.entries()).flatMap(
        ([supplier, aliases]) => aliases.map((alias) => [alias, supplier]),
      ),
    ].map(([value, supplier]) => [normalizeCode(value), supplier]),
  ).entries(),
)
  .map(([normalizedValue, supplier]) => ({
    normalizedValue,
    supplier,
  }))
  .sort(
    (left, right) => right.normalizedValue.length - left.normalizedValue.length,
  );

const SYSTEM_LOOKUP = new Map(
  SYSTEMS.map((system) => [normalizeCode(system), system]),
);

function matchKnownSupplier(segment) {
  const normalizedSegment = normalizeCode(segment);
  return (
    SUPPLIER_LOOKUP.get(normalizedSegment) ??
    SUPPLIER_ALIAS_LOOKUP.get(normalizedSegment) ??
    findFuzzySupplierMatch(normalizedSegment)
  );
}

function normalizeSupplierName(segment) {
  const cleanedSegment = cleanText(segment);
  if (!cleanedSegment) {
    return null;
  }

  return matchKnownSupplier(cleanedSegment);
}

function findSupplierMention(segment) {
  const normalizedSegment = normalizeCode(segment);
  if (!normalizedSegment) {
    return null;
  }

  for (const candidate of SUPPLIER_SEGMENT_CANDIDATES) {
    const escapedCandidate = candidate.normalizedValue.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    if (new RegExp(`(^| )${escapedCandidate}( |$)`).test(normalizedSegment)) {
      return candidate.supplier;
    }
  }

  return null;
}

function getEditDistanceWithinLimit(left, right, limit) {
  if (left === right) {
    return 0;
  }

  if (Math.abs(left.length - right.length) > limit) {
    return limit + 1;
  }

  let previousRow = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const currentRow = [leftIndex + 1];
    let rowMinimum = currentRow[0];

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      const value = Math.min(
        previousRow[rightIndex + 1] + 1,
        currentRow[rightIndex] + 1,
        previousRow[rightIndex] + substitutionCost,
      );
      currentRow.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > limit) {
      return limit + 1;
    }

    previousRow = currentRow;
  }

  return previousRow[right.length];
}

function findFuzzySupplierMatch(normalizedSegment) {
  if (!normalizedSegment) {
    return null;
  }

  const maxDistance = 2;
  let bestMatch = null;
  let bestDistance = maxDistance + 1;

  for (const candidate of SUPPLIER_FUZZY_CANDIDATES) {
    const distance = getEditDistanceWithinLimit(
      normalizedSegment,
      candidate.normalizedValue,
      maxDistance,
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate.supplier;
    }
  }

  return bestDistance <= maxDistance ? bestMatch : null;
}

function getFileType(fileName) {
  const extensionMatch = fileName.match(/\.([^.]+)$/);
  return extensionMatch ? extensionMatch[1].toLowerCase() : null;
}

// Approval detection is intentionally catalog-driven so every CDD/SAM decision
// can be traced back to one named rule instead of a loose substring heuristic.
const APPROVAL_RULES = [
  {
    key: "sample-leading-code",
    type: APPROVAL_TYPES.S,
    pattern: /^S($|[ .-])/,
  },
  {
    key: "cdd-leading-code",
    type: APPROVAL_TYPES.D,
    pattern: /^D($|[ .-])/,
  },
  {
    key: "sample-named-with-status",
    type: APPROVAL_TYPES.S,
    pattern: /(^| )SAM(PLE)?( |$)/,
    requiresStatus: true,
  },
  {
    key: "cdd-drawing-with-status",
    type: APPROVAL_TYPES.D,
    pattern: /(^| )((FIN(AL)?) )?(DIE|DRG|DRAWING|CDD)( |$)/,
    requiresStatus: true,
  },
];

const APPROVAL_CANDIDATE_PATTERNS = [
  /(^| )(S|SAM|SAMPLE)( |$)/,
  /(^| )D($| )/,
  /(^| )(DIE|DRG|DRAWING|FIN|FINAL)( |$)/,
  /(^| )(APP|APPD|APPR|APD|APV|APRD|APPRD|APPROVED|REJ|REJECTED|COMM|COMMENTS?|WC)( |$)/,
];

function getTodayIsoDate() {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFutureIsoDate(isoDate) {
  return isoDate > getTodayIsoDate();
}

function toFullYear(rawYear) {
  const year = Number(rawYear);
  if (!Number.isInteger(year)) {
    return null;
  }

  return rawYear.length === 4 ? year : 2000 + year;
}

function buildIsoDate(year, month, day) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function isValidCalendarDate(year, month, day) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const candidate = new Date(year, month - 1, day);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

function buildDateCandidate(dayText, monthText, yearText) {
  const day = Number(dayText);
  const month = Number(monthText);
  const year = toFullYear(yearText);

  if (!Number.isInteger(day) || !Number.isInteger(month) || year === null) {
    return null;
  }

  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  return {
    day,
    month,
    year,
    date: buildIsoDate(year, month, day),
  };
}

// Dates are validated separately from extraction so we can explain when a date
// stayed as-is, was reordered, is still future-dated, or is simply invalid.
function analyzeDate(rawDate) {
  const cleanedRawDate = cleanText(rawDate) || null;

  if (!cleanedRawDate) {
    return {
      rawDate: null,
      date: null,
      dateValidationStatus: DATE_VALIDATION_STATUS.MISSING,
      dateWasReordered: false,
      dateIsFuture: false,
      notes: [],
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanedRawDate)) {
    const [year, month, day] = cleanedRawDate.split("-").map(Number);
    if (!isValidCalendarDate(year, month, day)) {
      return {
        rawDate: cleanedRawDate,
        date: null,
        dateValidationStatus: DATE_VALIDATION_STATUS.INVALID,
        dateWasReordered: false,
        dateIsFuture: false,
        notes: [`Invalid ISO date: ${cleanedRawDate}`],
      };
    }

    const dateIsFuture = isFutureIsoDate(cleanedRawDate);
    return {
      rawDate: cleanedRawDate,
      date: cleanedRawDate,
      dateValidationStatus: dateIsFuture
        ? DATE_VALIDATION_STATUS.FUTURE
        : DATE_VALIDATION_STATUS.VALID,
      dateWasReordered: false,
      dateIsFuture,
      notes: dateIsFuture ? [`Future date detected: ${cleanedRawDate}`] : [],
    };
  }

  const parts = cleanedRawDate
    .replace(/[^\d]+/g, ".")
    .split(".")
    .filter(Boolean);
  if (parts.length !== 3) {
    return {
      rawDate: cleanedRawDate,
      date: null,
      dateValidationStatus: DATE_VALIDATION_STATUS.INVALID,
      dateWasReordered: false,
      dateIsFuture: false,
      notes: [`Could not parse date: ${cleanedRawDate}`],
    };
  }

  const [dayText, monthText, yearText] = parts;
  const primaryCandidate = buildDateCandidate(dayText, monthText, yearText);
  const swappedCandidate = buildDateCandidate(monthText, dayText, yearText);
  const isAmbiguousDayMonth = Number(dayText) <= 12 && Number(monthText) <= 12;

  if (!primaryCandidate && swappedCandidate) {
    return {
      rawDate: cleanedRawDate,
      date: swappedCandidate.date,
      dateValidationStatus: DATE_VALIDATION_STATUS.REORDERED,
      dateWasReordered: true,
      dateIsFuture: false,
      notes: [
        `Date reordered to resolve invalid day/month order: ${cleanedRawDate}`,
      ],
    };
  }

  if (!primaryCandidate) {
    return {
      rawDate: cleanedRawDate,
      date: null,
      dateValidationStatus: DATE_VALIDATION_STATUS.INVALID,
      dateWasReordered: false,
      dateIsFuture: false,
      notes: [`Invalid calendar date: ${cleanedRawDate}`],
    };
  }

  const primaryIsFuture = isFutureIsoDate(primaryCandidate.date);
  if (
    primaryIsFuture &&
    isAmbiguousDayMonth &&
    swappedCandidate &&
    !isFutureIsoDate(swappedCandidate.date)
  ) {
    return {
      rawDate: cleanedRawDate,
      date: swappedCandidate.date,
      dateValidationStatus: DATE_VALIDATION_STATUS.REORDERED,
      dateWasReordered: true,
      dateIsFuture: false,
      notes: [
        `Date reordered because the original parse was future-dated: ${cleanedRawDate}`,
      ],
    };
  }

  return {
    rawDate: cleanedRawDate,
    date: primaryCandidate.date,
    dateValidationStatus: primaryIsFuture
      ? DATE_VALIDATION_STATUS.FUTURE
      : DATE_VALIDATION_STATUS.VALID,
    dateWasReordered: false,
    dateIsFuture: primaryIsFuture,
    notes: primaryIsFuture
      ? [`Future date detected: ${primaryCandidate.date}`]
      : [],
  };
}

function normalizeApprovalStatus(approvalChunk) {
  const normalizedChunk = normalizeCode(approvalChunk);

  if (!normalizedChunk) {
    return null;
  }

  if (/(^| )(REJ|REJECTED)( |$)/.test(normalizedChunk)) {
    return "Rejected";
  }

  if (
    /(W C|WC|W COM|W COMM|WITH COMMENTS?|COMM|COMMENTS?)/.test(
      normalizedChunk,
    ) ||
    /(APD C|APPD C|APD WC|APPD WC|APD W C|APPD W C|APV WC|APV W C|APPRD W COM|APPRD W COMM|APPROVED WITH COMMENTS)/.test(
      normalizedChunk,
    )
  ) {
    return "Approved with Comments";
  }

  if (
    /(^| )(APP|APPD|APPR|APD|APV|APRD|APPRD|APPROVED)( |$)/.test(
      normalizedChunk,
    )
  ) {
    return "Approved";
  }

  return null;
}

function looksLikeApprovalCandidate(approvalChunk) {
  const normalizedChunk = normalizeCode(approvalChunk);

  if (!normalizedChunk || normalizedChunk === "-") {
    return false;
  }

  return APPROVAL_CANDIDATE_PATTERNS.some((pattern) =>
    pattern.test(normalizedChunk),
  );
}

function findApprovalRule(normalizedChunk, approvalStatus) {
  for (const rule of APPROVAL_RULES) {
    if (rule.requiresStatus && !approvalStatus) {
      continue;
    }

    if (rule.pattern.test(normalizedChunk)) {
      return rule;
    }
  }

  return null;
}

function isValidStructuredIdentifier(value) {
  const cleanedValue = trimTokenSeparators(value).toUpperCase();
  if (!cleanedValue || cleanedValue.includes(" ")) {
    return false;
  }

  const normalizedValue = cleanedValue.replace(/[.]/g, "");
  if (!/^[A-Z0-9-]+$/.test(normalizedValue)) {
    return false;
  }

  return (
    /\d/.test(normalizedValue) && !INVALID_REFERENCE_WORDS.has(normalizedValue)
  );
}

function extractTrailingValue(text, pattern) {
  const cleanedText = trimTokenSeparators(text);
  const match = cleanedText.match(pattern);
  if (!match || match.index === undefined) {
    return {
      remainder: cleanedText,
      value: null,
    };
  }

  return {
    remainder: trimTokenSeparators(cleanedText.slice(0, match.index)),
    value: cleanText(match.groups?.value) || null,
  };
}

function extractEmbeddedRevision(text) {
  const cleanedText = cleanText(text);
  const groupedMatch = cleanedText.match(GROUPED_REVISION_PATTERN);
  if (groupedMatch && groupedMatch.index !== undefined) {
    return {
      remainder: trimTokenSeparators(
        `${cleanedText.slice(0, groupedMatch.index)} ${cleanedText.slice(groupedMatch.index + groupedMatch[0].length)}`,
      ),
      value: `R${groupedMatch.groups?.number}`,
    };
  }

  const inlineMatch = cleanedText.match(INLINE_REVISION_PATTERN);
  if (!inlineMatch || inlineMatch.index === undefined) {
    return {
      remainder: cleanedText,
      value: null,
    };
  }

  return {
    remainder: trimTokenSeparators(
      `${cleanedText.slice(0, inlineMatch.index)} ${cleanedText.slice(inlineMatch.index + inlineMatch[0].length)}`,
    ),
    value: cleanText(inlineMatch.groups?.value) || null,
  };
}

function extractReferenceParts(rawStem) {
  const cleanedStem = trimTokenSeparators(rawStem);
  if (!cleanedStem) {
    return {
      referenceCandidate: null,
      dieNumberCandidate: null,
      approvalChunkCandidate: null,
    };
  }

  const openIndex = cleanedStem.indexOf("(");
  const closeIndex =
    openIndex >= 0 ? cleanedStem.indexOf(")", openIndex + 1) : -1;

  if (openIndex > 0 && closeIndex > openIndex) {
    return {
      referenceCandidate:
        trimTokenSeparators(cleanedStem.slice(0, openIndex)) || null,
      dieNumberCandidate:
        trimTokenSeparators(cleanedStem.slice(openIndex + 1, closeIndex)) ||
        null,
      approvalChunkCandidate:
        trimTokenSeparators(cleanedStem.slice(closeIndex + 1)) || null,
    };
  }

  const compactApprovalMatch = cleanedStem.match(
    COMPACT_APPROVAL_SUFFIX_PATTERN,
  );
  if (
    compactApprovalMatch?.groups?.reference &&
    isValidStructuredIdentifier(compactApprovalMatch.groups.reference)
  ) {
    return {
      referenceCandidate:
        trimTokenSeparators(compactApprovalMatch.groups.reference) || null,
      dieNumberCandidate: null,
      approvalChunkCandidate:
        trimTokenSeparators(compactApprovalMatch.groups.approval) || null,
    };
  }

  if (isValidStructuredIdentifier(cleanedStem)) {
    return {
      referenceCandidate: cleanedStem,
      dieNumberCandidate: null,
      approvalChunkCandidate: null,
    };
  }

  const [firstToken, ...restTokens] = cleanedStem.split(/\s+/).filter(Boolean);
  if (firstToken && isValidStructuredIdentifier(firstToken)) {
    return {
      referenceCandidate: firstToken,
      dieNumberCandidate: null,
      approvalChunkCandidate: trimTokenSeparators(restTokens.join(" ")) || null,
    };
  }

  return {
    referenceCandidate: null,
    dieNumberCandidate: null,
    approvalChunkCandidate: looksLikeApprovalCandidate(cleanedStem)
      ? cleanedStem
      : null,
  };
}

// Approval analysis returns both the final category and the evidence used to
// reach it so unmatched patterns can be audited against the real dataset later.
function analyzeApprovalChunk(approvalChunk, hasValidReference) {
  const cleanedChunk = cleanText(approvalChunk) || null;
  const normalizedChunk = normalizeCode(approvalChunk);

  if (!normalizedChunk) {
    return {
      approvalChunk: cleanedChunk,
      approvalType: null,
      approvalRuleKey: null,
      approvalPatternUnmatched: false,
      approvalStatus: null,
      notes: [],
    };
  }

  const approvalStatus = normalizeApprovalStatus(approvalChunk);
  const approvalRule = hasValidReference
    ? findApprovalRule(normalizedChunk, approvalStatus)
    : null;
  const approvalPatternUnmatched =
    looksLikeApprovalCandidate(approvalChunk) && !approvalRule;
  const notes = [];

  if (approvalPatternUnmatched) {
    notes.push(
      hasValidReference
        ? `Review approval pattern: ${cleanedChunk}`
        : `Approval-like text without valid reference: ${cleanedChunk}`,
    );
  }

  return {
    approvalChunk: cleanedChunk,
    approvalType: approvalRule?.type ?? null,
    approvalRuleKey: approvalRule?.key ?? null,
    approvalPatternUnmatched,
    approvalStatus,
    notes,
  };
}

function buildValidationNotes(...noteGroups) {
  const notes = noteGroups.flat().filter(Boolean);
  return notes.length > 0 ? notes.join(" | ") : null;
}

function normalizeRevision(rawRevision, rawReferenceNumber) {
  if (rawRevision) {
    const bracketRevisionMatch = cleanText(rawRevision).match(/^R\s*(\d+)$/i);
    if (bracketRevisionMatch) {
      return bracketRevisionMatch[1];
    }

    return cleanText(rawRevision).toUpperCase();
  }

  const referenceMatch = cleanText(rawReferenceNumber).match(
    /^(.*?)[\s-]+(P\d+|REV(?:ISION)?[\s-]*[A-Z0-9]+)$/i,
  );
  return referenceMatch ? cleanText(referenceMatch[2]).toUpperCase() : "0";
}

function normalizeReferenceNumber(rawReferenceNumber, revision) {
  const cleanedReference = cleanText(rawReferenceNumber);

  if (!cleanedReference || !revision) {
    return cleanedReference || null;
  }

  const escapedRevision = revision.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    cleanText(
      cleanedReference.replace(
        new RegExp(`[\\s-]+${escapedRevision}$`, "i"),
        "",
      ),
    ) || null
  );
}

function extractProjectInfo(path) {
  const segments = path.split("\\").map(cleanText).filter(Boolean);
  const normalizedSegments = segments.map((segment) => normalizeCode(segment));
  const projectsRootIndex = normalizedSegments.indexOf(PROJECTS_ROOT);
  const wiconaRootIndex = normalizedSegments.findIndex((segment) =>
    WICONA_PROJECTS_FOLDER_ALIASES.has(segment),
  );

  if (projectsRootIndex === -1 && wiconaRootIndex === -1) {
    return {
      project: null,
      projectIndex: -1,
      isWiconaProject: false,
      segments,
      normalizedSegments,
    };
  }

  const isNestedWiconaProject =
    projectsRootIndex >= 0 &&
    WICONA_PROJECTS_FOLDER_ALIASES.has(
      normalizedSegments[projectsRootIndex + 1],
    );
  const isDirectWiconaProject = wiconaRootIndex === 0;
  const isWiconaProject = isNestedWiconaProject || isDirectWiconaProject;
  const projectIndex = isDirectWiconaProject
    ? 1
    : isNestedWiconaProject
      ? projectsRootIndex + 2
      : projectsRootIndex + 1;

  return {
    project: cleanText(segments[projectIndex]) || null,
    projectIndex,
    isWiconaProject,
    segments,
    normalizedSegments,
  };
}

function extractSystem(path) {
  const normalizedPath = normalizeCode(path);

  for (const [normalizedSystem, system] of SYSTEM_LOOKUP.entries()) {
    if (normalizedPath.includes(normalizedSystem)) {
      return system;
    }
  }

  return null;
}

function isSupplierCandidateSegment(segment, index, segments) {
  const normalizedSegment = normalizeCode(segment);
  return (
    Boolean(segment) &&
    index < segments.length - 1 &&
    !GENERIC_SUPPLIER_SEGMENTS.has(normalizedSegment) &&
    !/\.[A-Z0-9]{2,5}$/i.test(segment)
  );
}

function extractSupplier(path, approvalType, projectInfo) {
  const segments =
    projectInfo?.segments ?? path.split("\\").map(cleanText).filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const supplier = matchKnownSupplier(segments[index]);
    if (supplier) {
      return supplier;
    }
  }

  if (projectInfo?.projectIndex >= 0) {
    const supplierSegmentIndex = projectInfo.projectIndex + 1;
    const supplierSegment = segments[supplierSegmentIndex];
    const supplierMention = findSupplierMention(supplierSegment);

    if (supplierMention) {
      return supplierMention;
    }

    if (
      isSupplierCandidateSegment(
        supplierSegment,
        supplierSegmentIndex,
        segments,
      )
    ) {
      return normalizeSupplierName(supplierSegment);
    }

    if (projectInfo.isWiconaProject) {
      return supplierMention ?? "WICONA";
    }
  }

  if (normalizeCode(segments[0]) === "PENDING SAMPLES" && segments[1]) {
    return normalizeSupplierName(segments[1]);
  }

  if (
    (approvalType === APPROVAL_TYPES.D || approvalType === APPROVAL_TYPES.S) &&
    segments[0]
  ) {
    const normalizedFirstSegment = normalizeCode(segments[0]);
    if (!GENERIC_SUPPLIER_SEGMENTS.has(normalizedFirstSegment)) {
      return normalizeSupplierName(segments[0]);
    }
  }

  return null;
}

function extractFcdd(path) {
  return /FCDD|FINAL COUNTER DIE DRAWINGS|FINAL DRAWINGS OR RECORD/i.test(path);
}

function buildStructureNotes(referenceCandidate, dieNumberCandidate) {
  const notes = [];

  if (referenceCandidate && !isValidStructuredIdentifier(referenceCandidate)) {
    notes.push(`Ignored invalid reference: ${referenceCandidate}`);
  }

  if (dieNumberCandidate && !isValidStructuredIdentifier(dieNumberCandidate)) {
    notes.push(`Ignored invalid die number: ${dieNumberCandidate}`);
  }

  return notes;
}

/**
 * @param {string} rawLine
 * @param {string | null} [itemType]
 * @returns {FileAnalysisRecord | null}
 */
export function parseLine(rawLine, itemType = null) {
  const path = normalizePath(rawLine);
  if (!path) {
    return null;
  }

  const fileName = path.split("\\").pop() ?? "";
  if (!fileName) {
    return null;
  }

  const fileType = getFileType(fileName);
  const fileStem = fileName.replace(/\.[^.]+$/, "");
  const { remainder: stemWithoutEmbeddedRevision, value: embeddedRevision } =
    extractEmbeddedRevision(fileStem);
  const { remainder: stemWithoutRevision, value: rawRevisionSuffix } =
    extractTrailingValue(
      stemWithoutEmbeddedRevision,
      TRAILING_REVISION_PATTERN,
    );
  const { remainder: stemWithoutDate, value: rawDate } = extractTrailingValue(
    stemWithoutRevision,
    TRAILING_DATE_PATTERN,
  );
  const { referenceCandidate, dieNumberCandidate, approvalChunkCandidate } =
    extractReferenceParts(stemWithoutDate);
  const structureNotes = buildStructureNotes(
    referenceCandidate,
    dieNumberCandidate,
  );
  const referenceNumber = isValidStructuredIdentifier(referenceCandidate)
    ? normalizeReferenceNumber(referenceCandidate, null)
    : null;
  const dieNumber = isValidStructuredIdentifier(dieNumberCandidate)
    ? trimTokenSeparators(dieNumberCandidate)
    : null;

  const approvalAnalysis = analyzeApprovalChunk(
    approvalChunkCandidate,
    Boolean(referenceNumber),
  );
  const dateAnalysis = analyzeDate(rawDate);
  const revision = normalizeRevision(
    embeddedRevision ?? rawRevisionSuffix,
    referenceCandidate ?? stemWithoutDate ?? fileStem,
  );
  const projectInfo = extractProjectInfo(path);

  return {
    fileName,
    path,
    project: projectInfo.project,
    supplier: extractSupplier(path, approvalAnalysis.approvalType, projectInfo),
    system: extractSystem(path),
    referenceNumber,
    dieNumber,
    approvalChunk: approvalAnalysis.approvalChunk,
    approvalType: approvalAnalysis.approvalType,
    approvalRuleKey: approvalAnalysis.approvalRuleKey,
    approvalPatternUnmatched: approvalAnalysis.approvalPatternUnmatched,
    approvalStatus: approvalAnalysis.approvalStatus,
    itemType,
    rawDate: dateAnalysis.rawDate,
    date: dateAnalysis.date,
    dateValidationStatus: dateAnalysis.dateValidationStatus,
    dateWasReordered: dateAnalysis.dateWasReordered,
    dateIsFuture: dateAnalysis.dateIsFuture,
    revision,
    fileType,
    validationNotes: buildValidationNotes(
      structureNotes,
      approvalAnalysis.notes,
      dateAnalysis.notes,
    ),
    fcdd: extractFcdd(path),
  };
}

/**
 * Convert a multi-line text input into one parsed record per non-empty row.
 *
 * @param {string} rawText
 * @param {string | null} [itemType]
 * @returns {FileAnalysisRecord[]}
 */
export function parseLines(rawText, itemType = null) {
  return rawText
    .split(/\r?\n/)
    .map((line) => parseLine(line, itemType))
    .filter((record) => record !== null);
}

function toSortedCountList(counter) {
  return Array.from(counter.entries())
    .map(([value, count]) => ({ value, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.value.localeCompare(right.value),
    );
}

export function summarizeParsedRecords(records) {
  const approvalRuleCounts = new Map();
  const unmatchedApprovalCounts = new Map();
  const dateStatusCounts = new Map(
    Object.values(DATE_VALIDATION_STATUS).map((status) => [status, 0]),
  );

  for (const record of records) {
    if (record.approvalRuleKey) {
      approvalRuleCounts.set(
        record.approvalRuleKey,
        (approvalRuleCounts.get(record.approvalRuleKey) ?? 0) + 1,
      );
    }

    if (record.approvalPatternUnmatched && record.approvalChunk) {
      unmatchedApprovalCounts.set(
        record.approvalChunk,
        (unmatchedApprovalCounts.get(record.approvalChunk) ?? 0) + 1,
      );
    }

    dateStatusCounts.set(
      record.dateValidationStatus,
      (dateStatusCounts.get(record.dateValidationStatus) ?? 0) + 1,
    );
  }

  const reorderedCount =
    dateStatusCounts.get(DATE_VALIDATION_STATUS.REORDERED) ?? 0;
  const futureCount = dateStatusCounts.get(DATE_VALIDATION_STATUS.FUTURE) ?? 0;
  const invalidCount =
    dateStatusCounts.get(DATE_VALIDATION_STATUS.INVALID) ?? 0;

  return {
    totalRecords: records.length,
    approval: {
      matchedCount: records.filter((record) => Boolean(record.approvalRuleKey))
        .length,
      unmatchedCandidateCount: records.filter(
        (record) => record.approvalPatternUnmatched,
      ).length,
      matchedByRule: toSortedCountList(approvalRuleCounts),
      unmatchedCandidates: toSortedCountList(unmatchedApprovalCounts),
    },
    dates: {
      missingCount: dateStatusCounts.get(DATE_VALIDATION_STATUS.MISSING) ?? 0,
      validCount: dateStatusCounts.get(DATE_VALIDATION_STATUS.VALID) ?? 0,
      reorderedCount,
      futureCount,
      invalidCount,
      warningCount: reorderedCount + futureCount + invalidCount,
    },
  };
}
