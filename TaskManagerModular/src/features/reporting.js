    function getReportPeriodDefinition(period = currentReportPeriod, referenceDate = new Date()) {
      const safePeriod = ['weekly', 'monthly', 'quarterly', 'annual'].includes(period) ? period : 'monthly';
      const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

      if (safePeriod === 'weekly') {
        const currentWeek = getWorkingWeekInfo(now);
        const currentStart = currentWeek?.weekStart || getStartOfWeek(now, WORKING_WEEK_START_DAY);
        const currentEnd = currentWeek?.weekEnd || shiftDateByDays(currentStart, WORKING_WEEK_LENGTH_DAYS - 1);
        const previousStart = shiftDateByDays(currentStart, -7);
        const previousEnd = shiftDateByDays(currentEnd, -7);
        return {
          period: safePeriod,
          title: 'Weekly Task Review',
          trendTitle: 'Eight-week flow',
          trendSubtitle: 'Created versus completed work by working week.',
          start: currentStart,
          end: currentEnd,
          previousStart,
          previousEnd,
          rangeLabel: currentWeek ? `${currentWeek.label}, ${currentWeek.year} (${formatReportRange(currentStart, currentEnd)})` : formatReportRange(currentStart, currentEnd),
          bucketCount: 8,
          buildBucket(indexFromEnd) {
            const anchorStart = shiftDateByDays(currentStart, -(7 * indexFromEnd));
            const anchorEnd = shiftDateByDays(anchorStart, WORKING_WEEK_LENGTH_DAYS - 1);
            const info = getWorkingWeekInfo(anchorStart);
            return {
              key: `weekly-${toIsoDate(anchorStart)}`,
              label: info ? `W${info.weekNumber}` : formatShortDateLabel(anchorStart),
              fullLabel: info ? `${info.label} (${formatReportRange(anchorStart, anchorEnd)})` : formatReportRange(anchorStart, anchorEnd),
              start: anchorStart,
              end: anchorEnd
            };
          }
        };
      }

      if (safePeriod === 'quarterly') {
        const currentStart = startOfQuarter(now);
        const currentEnd = endOfQuarter(now);
        const previousStart = startOfQuarter(shiftDateByMonths(currentStart, -3));
        const previousEnd = endOfQuarter(previousStart);
        return {
          period: safePeriod,
          title: 'Quarterly Task Review',
          trendTitle: 'Quarterly flow',
          trendSubtitle: 'Created versus completed work by quarter.',
          start: currentStart,
          end: currentEnd,
          previousStart,
          previousEnd,
          rangeLabel: `${formatQuarterLabel(currentStart)} (${formatReportRange(currentStart, currentEnd)})`,
          bucketCount: 6,
          buildBucket(indexFromEnd) {
            const anchorStart = startOfQuarter(shiftDateByMonths(currentStart, -(indexFromEnd * 3)));
            const anchorEnd = endOfQuarter(anchorStart);
            return {
              key: `quarterly-${anchorStart.getFullYear()}-${anchorStart.getMonth()}`,
              label: formatQuarterLabel(anchorStart),
              fullLabel: `${formatQuarterLabel(anchorStart)} (${formatReportRange(anchorStart, anchorEnd)})`,
              start: anchorStart,
              end: anchorEnd
            };
          }
        };
      }

      if (safePeriod === 'annual') {
        const currentStart = startOfYear(now);
        const currentEnd = endOfYear(now);
        const previousStart = startOfYear(shiftDateByYears(currentStart, -1));
        const previousEnd = endOfYear(previousStart);
        return {
          period: safePeriod,
          title: 'Annual Task Review',
          trendTitle: 'Annual flow',
          trendSubtitle: 'Created versus completed work by year.',
          start: currentStart,
          end: currentEnd,
          previousStart,
          previousEnd,
          rangeLabel: `${currentStart.getFullYear()} (${formatReportRange(currentStart, currentEnd)})`,
          bucketCount: 5,
          buildBucket(indexFromEnd) {
            const anchorStart = startOfYear(shiftDateByYears(currentStart, -indexFromEnd));
            const anchorEnd = endOfYear(anchorStart);
            return {
              key: `annual-${anchorStart.getFullYear()}`,
              label: String(anchorStart.getFullYear()),
              fullLabel: `${anchorStart.getFullYear()} (${formatReportRange(anchorStart, anchorEnd)})`,
              start: anchorStart,
              end: anchorEnd
            };
          }
        };
      }

      const currentStart = startOfMonth(now);
      const currentEnd = endOfMonth(now);
      const previousStart = startOfMonth(shiftDateByMonths(currentStart, -1));
      const previousEnd = endOfMonth(previousStart);
      return {
        period: 'monthly',
        title: 'Monthly Task Review',
        trendTitle: 'Monthly flow',
        trendSubtitle: 'Created versus completed work by month.',
        start: currentStart,
        end: currentEnd,
        previousStart,
        previousEnd,
        rangeLabel: `${formatMonthYearLabel(currentStart)} (${formatReportRange(currentStart, currentEnd)})`,
        bucketCount: 6,
        buildBucket(indexFromEnd) {
          const anchorStart = startOfMonth(shiftDateByMonths(currentStart, -indexFromEnd));
          const anchorEnd = endOfMonth(anchorStart);
          return {
            key: `monthly-${anchorStart.getFullYear()}-${anchorStart.getMonth()}`,
            label: `${MONTH_LABELS[anchorStart.getMonth()]} ${String(anchorStart.getFullYear()).slice(-2)}`,
            fullLabel: `${formatMonthYearLabel(anchorStart)} (${formatReportRange(anchorStart, anchorEnd)})`,
            start: anchorStart,
            end: anchorEnd
          };
        }
      };
    }

    function buildReportBuckets(periodDefinition) {
      return Array.from({ length: periodDefinition.bucketCount }, (_, index) => periodDefinition.buildBucket(periodDefinition.bucketCount - 1 - index));
    }

    function sumReportSeries(series, key) {
      return series.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
    }

    function getReportDelta(currentValue, previousValue) {
      const delta = currentValue - previousValue;
      if (!previousValue && !currentValue) return 'Flat vs previous';
      if (!previousValue) return `+${currentValue} vs previous`;
      const percent = Math.round((delta / previousValue) * 100);
      if (delta === 0) return 'No change';
      return `${delta > 0 ? '+' : ''}${delta} (${delta > 0 ? '+' : ''}${percent}%)`;
    }

    function getTopDistributionEntry(entries) {
      return entries.find(entry => entry.value > 0) || entries[0] || null;
    }

    function buildAgingStats(openTasks) {
      const buckets = [
        { label: '0-7 days', min: 0, max: 7, accent: 'var(--low)' },
        { label: '8-14 days', min: 8, max: 14, accent: 'var(--accent)' },
        { label: '15-30 days', min: 15, max: 30, accent: 'var(--medium)' },
        { label: '31+ days', min: 31, max: Infinity, accent: 'var(--critical)' }
      ];

      return buckets.map(bucket => ({
        ...bucket,
        value: openTasks.filter(task => {
          const age = getTaskAgeInDays(task);
          return age !== null && age >= bucket.min && age <= bucket.max;
        }).length
      }));
    }

    function buildOpenCategoryStats(openTasks) {
      return categories.map(category => ({
        label: category.name,
        value: openTasks
          .filter(task => task.category === category.name)
          .reduce((sum, task) => sum + getTaskCategoryCountWeight(task), 0),
        accent: category.color || 'var(--accent)'
      })).sort((a, b) => b.value - a.value).slice(0, 6);
    }

    function buildOpenPriorityStats(openTasks) {
      return PRIORITY_OPTIONS.map(priority => ({
        label: priority,
        value: openTasks.filter(task => normalizePriority(task.priority) === priority).length,
        accent: PRIORITY_ACCENTS[priority] || 'var(--accent)'
      })).sort((a, b) => b.value - a.value);
    }

    function buildOpenStatusStats(openTasks) {
      return STATUS_OPTIONS
        .filter(status => status !== 'Completed')
        .map(status => ({
          label: status,
          value: openTasks.filter(task => normalizeStatus(task.status) === status).length,
          accent: STATUS_ACCENTS[status] || 'var(--accent)'
        }))
        .sort((a, b) => b.value - a.value);
    }

    function getReportData(period = currentReportPeriod) {
      const definition = getReportPeriodDefinition(period);
      const periodTasksCreated = tasks.filter(task => isDateWithinRange(task.createdAt, definition.start, definition.end));
      const periodTasksCompleted = tasks.filter(task => isTaskCompleted(task) && isDateWithinRange(task.completedAt, definition.start, definition.end));
      const previousPeriodTasksCompleted = tasks.filter(task => isTaskCompleted(task) && isDateWithinRange(task.completedAt, definition.previousStart, definition.previousEnd));
      const previousPeriodTasksCreated = tasks.filter(task => isDateWithinRange(task.createdAt, definition.previousStart, definition.previousEnd));
      const openTasks = tasks.filter(task => !isTaskCompleted(task));
      const overdueTasks = openTasks.filter(task => isOverdue(task.dueDate));
      const urgentTasks = openTasks.filter(task => ATTENTION_PRIORITIES.has(normalizePriority(task.priority)));
      const trendSeries = buildReportBuckets(definition).map(bucket => ({
        ...bucket,
        created: tasks.filter(task => isDateWithinRange(task.createdAt, bucket.start, bucket.end)).length,
        completed: tasks.filter(task => isTaskCompleted(task) && isDateWithinRange(task.completedAt, bucket.start, bucket.end)).length
      }));
      const maxTrendValue = Math.max(1, ...trendSeries.flatMap(bucket => [bucket.created, bucket.completed]));
      const categoryStats = buildOpenCategoryStats(openTasks);
      const priorityStats = buildOpenPriorityStats(openTasks);
      const statusStats = buildOpenStatusStats(openTasks);
      const agingStats = buildAgingStats(openTasks);
      const completionRate = periodTasksCreated.length
        ? Math.round((periodTasksCompleted.length / periodTasksCreated.length) * 100)
        : (periodTasksCompleted.length ? 100 : 0);
      const topCategory = getTopDistributionEntry(categoryStats);
      const topPriority = getTopDistributionEntry(priorityStats);
      const topStatus = getTopDistributionEntry(statusStats);
      const oldestOpenTask = openTasks
        .map(task => ({ task, age: getTaskAgeInDays(task) }))
        .filter(entry => entry.age !== null)
        .sort((a, b) => b.age - a.age)[0] || null;

      return {
        definition,
        trendSeries,
        maxTrendValue,
        categoryStats,
        priorityStats,
        statusStats,
        agingStats,
        completionRate,
        topCategory,
        topPriority,
        topStatus,
        oldestOpenTask,
        totals: {
          totalTasks: tasks.length,
          openTasks: openTasks.length,
          overdueTasks: overdueTasks.length,
          urgentTasks: urgentTasks.length,
          completedInPeriod: periodTasksCompleted.length,
          createdInPeriod: periodTasksCreated.length,
          previousCompletedInPeriod: previousPeriodTasksCompleted.length,
          previousCreatedInPeriod: previousPeriodTasksCreated.length
        }
      };
    }

    function renderReportKpis(reportData) {
      const { totals, completionRate } = reportData;
      const cards = [
        {
          label: 'Open workload',
          value: totals.openTasks,
          delta: `${totals.totalTasks} total saved`,
          hint: 'Current backlog snapshot across all active work.',
          accent: 'var(--accent)'
        },
        {
          label: 'Completed in period',
          value: totals.completedInPeriod,
          delta: getReportDelta(totals.completedInPeriod, totals.previousCompletedInPeriod),
          hint: 'Finished during the selected reporting window.',
          accent: 'var(--low)'
        },
        {
          label: 'Created in period',
          value: totals.createdInPeriod,
          delta: getReportDelta(totals.createdInPeriod, totals.previousCreatedInPeriod),
          hint: 'Incoming demand entering the queue this period.',
          accent: 'var(--accent-h)'
        },
        {
          label: 'Overdue now',
          value: totals.overdueTasks,
          delta: totals.overdueTasks ? 'Needs follow-up' : 'On track',
          hint: 'Open tasks with due dates earlier than today.',
          accent: 'var(--critical)'
        },
        {
          label: 'Period completion rate',
          value: `${completionRate}%`,
          delta: totals.createdInPeriod ? `${totals.completedInPeriod}/${totals.createdInPeriod}` : 'No new intake',
          hint: 'Completed divided by created during this reporting window.',
          accent: 'var(--medium)'
        }
      ];

      const kpiGrid = document.getElementById('reportKpiGrid');
      if (!kpiGrid) return;

      kpiGrid.innerHTML = cards.map(card => `
        <article class="report-kpi-card" style="--kpi-accent:${card.accent}">
          <span class="report-kpi-label">${escHtml(card.label)}</span>
          <div class="report-kpi-value-row">
            <strong class="report-kpi-value">${escHtml(String(card.value))}</strong>
            <span class="report-kpi-delta">${escHtml(card.delta)}</span>
          </div>
          <p class="report-kpi-hint">${escHtml(card.hint)}</p>
        </article>`).join('');
    }

    function buildLinePath(points) {
      if (!points.length) return '';
      return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    }

    function renderReportTrendChart(reportData) {
      const shell = document.getElementById('reportTrendChart');
      if (!shell) return;

      const { trendSeries, maxTrendValue, definition } = reportData;
      if (!trendSeries.length) {
        shell.innerHTML = '<div class="report-empty-state">No task history available yet for trend reporting.</div>';
        return;
      }

      const width = 760;
      const height = 220;
      const paddingX = 24;
      const paddingTop = 18;
      const paddingBottom = 28;
      const chartHeight = height - paddingTop - paddingBottom;
      const stepX = trendSeries.length > 1 ? (width - (paddingX * 2)) / (trendSeries.length - 1) : 0;
      const valueToY = value => paddingTop + (chartHeight - ((value / maxTrendValue) * chartHeight));
      const createdPoints = trendSeries.map((bucket, index) => ({ x: paddingX + (stepX * index), y: valueToY(bucket.created) }));
      const completedPoints = trendSeries.map((bucket, index) => ({ x: paddingX + (stepX * index), y: valueToY(bucket.completed) }));
      const gridValues = [0, .25, .5, .75, 1].map(value => Math.round(maxTrendValue * value)).reverse();
      const createdPath = buildLinePath(createdPoints);
      const completedPath = buildLinePath(completedPoints);
      const createdArea = `${createdPath} L ${createdPoints[createdPoints.length - 1].x.toFixed(2)} ${(height - paddingBottom).toFixed(2)} L ${createdPoints[0].x.toFixed(2)} ${(height - paddingBottom).toFixed(2)} Z`;

      shell.innerHTML = `
        <svg class="report-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Created and completed task trend">
          ${gridValues.map(value => {
            const y = valueToY(value);
            return `<line class="report-line-grid" x1="${paddingX}" y1="${y.toFixed(2)}" x2="${width - paddingX}" y2="${y.toFixed(2)}"></line>`;
          }).join('')}
          <path class="report-line-area" d="${createdArea}" fill="var(--accent)"></path>
          <path class="report-line-path" d="${createdPath}" stroke="var(--accent)"></path>
          <path class="report-line-path" d="${completedPath}" stroke="var(--low)"></path>
          ${createdPoints.map(point => `<circle class="report-line-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5" stroke="var(--accent)"></circle>`).join('')}
          ${completedPoints.map(point => `<circle class="report-line-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5" stroke="var(--low)"></circle>`).join('')}
        </svg>
        <div class="report-line-labels" style="--report-label-count:${trendSeries.length}">
          ${trendSeries.map(bucket => `<span title="${escHtml(bucket.fullLabel)}">${escHtml(bucket.label)}</span>`).join('')}
        </div>
        <div class="report-legend">
          <span class="report-legend-item"><span class="report-legend-swatch" style="--legend-color:var(--accent)"></span>Created</span>
          <span class="report-legend-item"><span class="report-legend-swatch" style="--legend-color:var(--low)"></span>Completed</span>
        </div>`;

      const trendTitle = document.getElementById('reportTrendTitle');
      const trendSubtitle = document.getElementById('reportTrendSubtitle');
      const trendMeta = document.getElementById('reportTrendMeta');
      if (trendTitle) trendTitle.textContent = definition.trendTitle;
      if (trendSubtitle) trendSubtitle.textContent = definition.trendSubtitle;
      if (trendMeta) {
        trendMeta.textContent = `${sumReportSeries(trendSeries, 'created')} created, ${sumReportSeries(trendSeries, 'completed')} completed across the recent ${definition.period} view.`;
      }
    }

    function renderReportDistribution(targetId, title, subtitle, entries) {
      const container = document.getElementById(targetId);
      if (!container) return;

      if (!entries.length || entries.every(entry => !entry.value)) {
        container.innerHTML = `
          <div class="report-card-header">
            <div>
              <h3>${escHtml(title)}</h3>
              <p>${escHtml(subtitle)}</p>
            </div>
          </div>
          <div class="report-empty-state">No data available yet.</div>`;
        return;
      }

      const maxValue = Math.max(1, ...entries.map(entry => entry.value));
      container.innerHTML = `
        <div class="report-card-header">
          <div>
            <h3>${escHtml(title)}</h3>
            <p>${escHtml(subtitle)}</p>
          </div>
        </div>
        ${entries.map(entry => `
          <div class="report-stack-row">
            <div class="report-stack-row-head">
              <strong>${escHtml(entry.label)}</strong>
              <span>${escHtml(String(entry.value))}</span>
            </div>
            <div class="report-stack-bar" style="--bar-accent:${entry.accent || 'var(--accent)'}; --bar-width:${Math.max(6, Math.round((entry.value / maxValue) * 100))}%">
              <span></span>
            </div>
          </div>`).join('')}`;
    }

    function renderReportInsights(reportData) {
      const insightsHost = document.getElementById('reportInsights');
      if (!insightsHost) return;

      const { definition, totals, topCategory, topPriority, topStatus, oldestOpenTask, agingStats } = reportData;
      const backlogBucket = getTopDistributionEntry(agingStats);
      const insights = [
        {
          accent: 'var(--low)',
          title: `${totals.completedInPeriod} task${totals.completedInPeriod === 1 ? '' : 's'} completed this ${definition.period.replace('ly', '')}`,
          body: totals.previousCompletedInPeriod
            ? `That is ${getReportDelta(totals.completedInPeriod, totals.previousCompletedInPeriod).toLowerCase()} compared with the previous ${definition.period.replace('ly', '')} window.`
            : 'This is the first comparable reporting window with completed work recorded.'
        },
        {
          accent: topCategory?.accent || 'var(--accent)',
          title: topCategory?.value ? `${topCategory.label} is carrying the heaviest open load` : 'Category mix is still light',
          body: topCategory?.value
            ? `${topCategory.value} open unit${topCategory.value === 1 ? '' : 's'} currently sit in ${topCategory.label}, making it the dominant category in the backlog.`
            : 'Add a few categorized tasks and this section will start surfacing workload concentration.'
        },
        {
          accent: topPriority?.accent || 'var(--critical)',
          title: `${totals.urgentTasks} urgent task${totals.urgentTasks === 1 ? '' : 's'} need attention`,
          body: topPriority?.value
            ? `${topPriority.label} currently leads the priority mix, while ${topStatus?.label || 'the active workflow'} is the strongest open status signal.`
            : 'Priority distribution will populate as tasks are added.'
        },
        {
          accent: backlogBucket?.accent || 'var(--medium)',
          title: totals.overdueTasks ? `${totals.overdueTasks} overdue task${totals.overdueTasks === 1 ? '' : 's'} are now at risk` : 'No overdue tasks in the live backlog',
          body: oldestOpenTask?.task
            ? `The oldest active task is ${oldestOpenTask.task.title} at ${oldestOpenTask.age} day${oldestOpenTask.age === 1 ? '' : 's'} old.`
            : 'As the task history grows, aging insights will highlight stale work and bottlenecks.'
        }
      ];

      insightsHost.innerHTML = insights.map(insight => `
        <article class="report-insight-item" style="--insight-accent:${insight.accent}">
          <strong>${escHtml(insight.title)}</strong>
          <p>${escHtml(insight.body)}</p>
        </article>`).join('');
    }

    function renderReportSummary(reportData) {
      const summaryHost = document.getElementById('reportSummaryCopy');
      if (!summaryHost) return;

      const { definition, totals, topCategory, topStatus } = reportData;
      const summaryParagraphs = [
        `For the current ${definition.period.replace('ly', '')} reporting window, <strong>${totals.completedInPeriod}</strong> task${totals.completedInPeriod === 1 ? '' : 's'} were completed while <strong>${totals.createdInPeriod}</strong> new task${totals.createdInPeriod === 1 ? '' : 's'} entered the queue. The live backlog now stands at <strong>${totals.openTasks}</strong> open task${totals.openTasks === 1 ? '' : 's'} overall.`,
        topCategory?.value
          ? `<strong>${escHtml(topCategory.label)}</strong> currently carries the largest share of open work with ${topCategory.value} unit${topCategory.value === 1 ? '' : 's'}, while <strong>${escHtml(topStatus?.label || 'active work')}</strong> is the strongest current status signal across the board.`
          : 'Category and status highlights will become more descriptive as more task history is saved in the app.',
        totals.overdueTasks
          ? `There ${totals.overdueTasks === 1 ? 'is' : 'are'} <strong>${totals.overdueTasks}</strong> overdue task${totals.overdueTasks === 1 ? '' : 's'} that should be reviewed first in the next planning pass, especially before the next report is sent.`
          : 'There are <strong>no overdue tasks</strong> in the current open backlog, which keeps the report in a healthy state for external sharing.'
      ];

      summaryHost.innerHTML = summaryParagraphs.map(paragraph => `<p>${paragraph}</p>`).join('');

      const stampTitle = document.getElementById('reportStampTitle');
      const stampMeta = document.getElementById('reportStampMeta');
      if (stampTitle) stampTitle.textContent = definition.title;
      if (stampMeta) {
        stampMeta.textContent = `${definition.rangeLabel}. Generated ${new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`;
      }
    }

    function renderReportDashboard() {
      const reportData = getReportData(currentReportPeriod);
      const { definition } = reportData;
      const rangeLabel = document.getElementById('reportRangeLabel');
      const generatedLabel = document.getElementById('reportGeneratedLabel');
      const subtitle = document.getElementById('reportModalSubtitle');

      document.querySelectorAll('#reportPeriodSwitch [data-report-period]').forEach(button => {
        const isActive = button.dataset.reportPeriod === currentReportPeriod;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      if (rangeLabel) rangeLabel.textContent = definition.rangeLabel;
      if (generatedLabel) generatedLabel.textContent = `Generated ${new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} from live task data.`;
      if (subtitle) subtitle.textContent = `${definition.title} with trend, distribution, and email-ready summary blocks for quick sharing.`;

      renderReportKpis(reportData);
      renderReportTrendChart(reportData);
      renderReportDistribution('reportCategoryBreakdown', 'Category load', 'Open units by category.', reportData.categoryStats);
      renderReportDistribution('reportPriorityBreakdown', 'Priority mix', 'Open tasks by priority.', reportData.priorityStats);
      renderReportDistribution('reportStatusBreakdown', 'Status mix', 'Open tasks by workflow state.', reportData.statusStats);
      renderReportDistribution('reportAgingBreakdown', 'Aging watch', 'Open tasks grouped by age.', reportData.agingStats);
      renderReportInsights(reportData);
      renderReportSummary(reportData);
    }

