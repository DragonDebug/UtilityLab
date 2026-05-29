import {
  aggregateApprovalRecords,
  APPROVAL_FILTERS,
  DEFAULT_APPROVAL_DASHBOARD_FILTERS,
  PERIOD_FILTERS,
  STATUS_FILTERS,
} from "./approvalAnalytics.js";

const CHART_COLORS = {
  cdd: {
    border: "#07868f",
    fill: "rgba(7, 134, 143, 0.78)",
    hover: "rgba(7, 134, 143, 0.96)",
  },
  sam: {
    border: "#f08a24",
    fill: "rgba(240, 138, 36, 0.78)",
    hover: "rgba(240, 138, 36, 0.96)",
  },
};

const STATUS_ACCENTS = new Map([
  ["Approved", "#15995b"],
  ["Approved with Comments", "#d97706"],
  ["Rejected", "#dc2626"],
  ["Unclassified", "#64748b"],
]);

const dashboardState = { ...DEFAULT_APPROVAL_DASHBOARD_FILTERS };
let currentRecords = [];
let approvalChart = null;

function byId(id) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an element with id "${id}".`);
  }

  return element;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function getChartLibrary() {
  return globalThis.Chart;
}

function destroyChart() {
  if (approvalChart) {
    approvalChart.destroy();
    approvalChart = null;
  }
}

function setTabState(attribute, activeValue) {
  document.querySelectorAll(`[${attribute}]`).forEach((button) => {
    const isActive = button.getAttribute(attribute) === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function syncControls() {
  setTabState("data-approval-item-type", dashboardState.itemType);
  setTabState("data-approval-period", dashboardState.period);
  setTabState("data-approval-type", dashboardState.approvalType);

  const statusSelect = byId("approval-status-select");
  if (statusSelect instanceof HTMLSelectElement) {
    statusSelect.value = dashboardState.approvalStatus;
  }

  const revisionsToggle = byId("include-revisions-toggle");
  if (revisionsToggle instanceof HTMLInputElement) {
    revisionsToggle.checked = dashboardState.includeRevisions;
  }

  const recentRangeToggle = byId("recent-range-toggle");
  if (recentRangeToggle instanceof HTMLInputElement) {
    recentRangeToggle.checked = dashboardState.showRecentOnly;
  }
}

function getPeriodLabel(period) {
  if (period === PERIOD_FILTERS.YEARLY) {
    return "year";
  }

  if (period === PERIOD_FILTERS.WEEKLY) {
    return "ISO week";
  }

  return "month";
}

function getApprovalTypeLabel(approvalType) {
  if (approvalType === APPROVAL_FILTERS.CDD) {
    return "CDD only";
  }

  if (approvalType === APPROVAL_FILTERS.SAM) {
    return "SAM only";
  }

  return "CDD and SAM";
}

function getStatusLabel(status) {
  if (status === STATUS_FILTERS.ALL) {
    return "all statuses";
  }

  if (status === STATUS_FILTERS.UNCLASSIFIED) {
    return "unclassified status";
  }

  return status;
}

function getRangeLabel(analysis) {
  if (!analysis.window.showRecentOnly) {
    return "showing the full chart history";
  }

  const unit = getPeriodLabel(dashboardState.period);
  const count = analysis.window.visibleBucketCount;
  const suffix = count === 1 ? "" : "s";
  return `showing the latest ${count} ${unit}${suffix}`;
}

function renderKpis(analysis) {
  const kpiHost = byId("approval-kpis");
  const cards = [
    {
      label: "Approval records",
      value: analysis.totals.all,
      hint: "PDF CDD and SAM records after the current filters.",
      accent: "#07868f",
    },
    {
      label: "CDD approvals",
      value: analysis.totals.cdd,
      hint: "Counter Die Drawing records in scope.",
      accent: CHART_COLORS.cdd.border,
    },
    {
      label: "SAM approvals",
      value: analysis.totals.sam,
      hint: "Sample records in scope.",
      accent: CHART_COLORS.sam.border,
    },
    {
      label: "Visible on chart",
      value: analysis.totals.plotted,
      hint: analysis.window.showRecentOnly
        ? "Dated PDF approval records visible in the reduced chart window."
        : "Dated PDF approval records visible in the chart.",
      accent: "#2563eb",
    },
    {
      label: dashboardState.includeRevisions
        ? "Revision records"
        : "Revisions excluded",
      value: dashboardState.includeRevisions
        ? analysis.totals.revisions
        : analysis.totals.excludedRevisions,
      hint: dashboardState.includeRevisions
        ? "Non-zero revisions included in the chart."
        : "Non-zero revisions removed from the chart.",
      accent: "#7c3aed",
    },
  ];

  kpiHost.innerHTML = cards
    .map(
      (card) => `
        <article class="approval-kpi-card" style="--metric-accent:${card.accent}">
            <span>${escapeHtml(card.label)}</span>
            <strong>${formatNumber(card.value)}</strong>
            <p>${escapeHtml(card.hint)}</p>
        </article>`,
    )
    .join("");
}

function renderMeta(analysis) {
  const meta = byId("approval-chart-meta");
  const itemScope =
    dashboardState.itemType === "all"
      ? "all item types"
      : dashboardState.itemType;
  const revisionScope = dashboardState.includeRevisions
    ? "including revisions"
    : "excluding revisions";

  meta.textContent = `${formatNumber(analysis.totals.all)} ${getApprovalTypeLabel(
    dashboardState.approvalType,
  )} PDF records across ${itemScope}, ${getStatusLabel(
    dashboardState.approvalStatus,
  )}, grouped by ${getPeriodLabel(dashboardState.period)}, ${revisionScope}, ${getRangeLabel(analysis)}.`;
}

function renderBreakdownPanel(title, subtitle, entries, fallbackAccent) {
  const maxValue = Math.max(1, ...entries.map((entry) => entry.count));
  const rows = entries.length
    ? entries
        .map((entry) => {
          const accent = STATUS_ACCENTS.get(entry.label) ?? fallbackAccent;
          const width = Math.max(6, Math.round((entry.count / maxValue) * 100));
          return `
            <div class="approval-breakdown-row">
                <div class="approval-breakdown-head">
                    <strong>${escapeHtml(entry.label)}</strong>
                    <span>${formatNumber(entry.count)}</span>
                </div>
                <div class="approval-breakdown-bar" style="--bar-accent:${accent}; --bar-width:${width}%"><span></span></div>
            </div>`;
        })
        .join("")
    : `<p class="approval-breakdown-empty">No matching approval records yet.</p>`;

  return `
    <article class="approval-breakdown-card">
        <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(subtitle)}</p>
        </div>
        ${rows}
    </article>`;
}

function renderBreakdowns(analysis) {
  const host = byId("approval-breakdowns");
  host.innerHTML = [
    renderBreakdownPanel(
      "Status Mix",
      "Current CDD/SAM approval records by approval status.",
      analysis.breakdowns.status,
      "#07868f",
    ),
    renderBreakdownPanel(
      "Item Type Mix",
      "Profile, Gaskets, and Accessories share after filters.",
      analysis.breakdowns.itemType,
      "#f08a24",
    ),
  ].join("");
}

function buildDatasets(analysis) {
  const datasets = [];

  if (dashboardState.approvalType !== APPROVAL_FILTERS.SAM) {
    datasets.push({
      label: "CDD approvals",
      data: analysis.timeline.map((bucket) => bucket.cdd),
      backgroundColor: CHART_COLORS.cdd.fill,
      borderColor: CHART_COLORS.cdd.border,
      hoverBackgroundColor: CHART_COLORS.cdd.hover,
      borderWidth: 1,
      borderRadius: 12,
      borderSkipped: false,
      stack: "approvals",
    });
  }

  if (dashboardState.approvalType !== APPROVAL_FILTERS.CDD) {
    datasets.push({
      label: "SAM approvals",
      data: analysis.timeline.map((bucket) => bucket.sam),
      backgroundColor: CHART_COLORS.sam.fill,
      borderColor: CHART_COLORS.sam.border,
      hoverBackgroundColor: CHART_COLORS.sam.hover,
      borderWidth: 1,
      borderRadius: 12,
      borderSkipped: false,
      stack: "approvals",
    });
  }

  return datasets;
}

function renderChart(analysis) {
  const canvas = byId("approval-chart");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Approval chart target is not a canvas element.");
  }

  const emptyState = byId("approval-chart-empty");
  const chartLibrary = getChartLibrary();

  if (!chartLibrary) {
    destroyChart();
    canvas.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent =
      "Chart.js could not be loaded. Check your connection and reload this local page.";
    return;
  }

  if (!analysis.timeline.length) {
    destroyChart();
    canvas.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent = analysis.totals.all
      ? `${formatNumber(analysis.totals.undated)} matching approval record(s) have no valid date, so they are counted in KPI cards but not plotted.`
      : analysis.totals.excludedNonPdf > 0
        ? "Matching approvals were found, but only PDF files are counted in the chart."
        : "Import PDF CDD or SAM approval records to populate the chart.";
    return;
  }

  canvas.hidden = false;
  emptyState.hidden = true;

  const data = {
    labels: analysis.timeline.map((bucket) => bucket.label),
    datasets: buildDatasets(analysis),
  };

  if (approvalChart) {
    approvalChart.data = data;
    approvalChart.update();
    return;
  }

  approvalChart = new chartLibrary(canvas, {
    type: "bar",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 520,
        easing: "easeOutQuart",
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#132635",
            boxWidth: 12,
            boxHeight: 12,
            useBorderRadius: true,
          },
        },
        tooltip: {
          backgroundColor: "rgba(19, 38, 53, 0.94)",
          borderColor: "rgba(255, 255, 255, 0.18)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            footer(items) {
              const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
              return `Total: ${formatNumber(total)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false,
          },
          ticks: {
            color: "#4e6474",
            maxRotation: 0,
            autoSkipPadding: 18,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            color: "#4e6474",
            precision: 0,
          },
          grid: {
            color: "rgba(33, 52, 68, 0.1)",
            drawBorder: false,
          },
        },
      },
    },
  });
}

export function renderApprovalDashboard(records) {
  currentRecords = Array.isArray(records) ? records : [];
  syncControls();

  const analysis = aggregateApprovalRecords(currentRecords, dashboardState);
  renderKpis(analysis);
  renderMeta(analysis);
  renderBreakdowns(analysis);
  renderChart(analysis);
}

export function bindApprovalDashboardControls() {
  document.querySelectorAll("[data-approval-item-type]").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardState.itemType =
        button.getAttribute("data-approval-item-type") ?? "all";
      renderApprovalDashboard(currentRecords);
    });
  });

  document.querySelectorAll("[data-approval-period]").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardState.period =
        button.getAttribute("data-approval-period") ?? PERIOD_FILTERS.MONTHLY;
      renderApprovalDashboard(currentRecords);
    });
  });

  document.querySelectorAll("[data-approval-type]").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardState.approvalType =
        button.getAttribute("data-approval-type") ?? APPROVAL_FILTERS.ALL;
      renderApprovalDashboard(currentRecords);
    });
  });

  const statusSelect = byId("approval-status-select");
  if (statusSelect instanceof HTMLSelectElement) {
    statusSelect.addEventListener("change", () => {
      dashboardState.approvalStatus = statusSelect.value;
      renderApprovalDashboard(currentRecords);
    });
  }

  const revisionsToggle = byId("include-revisions-toggle");
  if (revisionsToggle instanceof HTMLInputElement) {
    revisionsToggle.addEventListener("change", () => {
      dashboardState.includeRevisions = revisionsToggle.checked;
      renderApprovalDashboard(currentRecords);
    });
  }

  const recentRangeToggle = byId("recent-range-toggle");
  if (recentRangeToggle instanceof HTMLInputElement) {
    recentRangeToggle.addEventListener("change", () => {
      dashboardState.showRecentOnly = recentRangeToggle.checked;
      renderApprovalDashboard(currentRecords);
    });
  }
}
