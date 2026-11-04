/**
 * Chart.js is the one external dependency in the app. It is pinned to a single
 * version and loaded lazily so the rest of the UI never waits on a CDN.
 * The service worker caches this exact URL (see sw.js).
 */
export const CHART_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';

let pending = null;

export function loadChartJS() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHART_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () =>
      window.Chart
        ? resolve(window.Chart)
        : reject(new Error('Chart.js loaded without registering'));
    script.onerror = () => {
      pending = null;
      reject(new Error('Chart.js could not be loaded'));
    };
    document.head.appendChild(script);
  });
  return pending;
}

const read = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const TONE_VAR = {
  accent: 'accent',
  sage: 'sage',
  ochre: 'ochre',
  rose: 'rose',
  indigo: 'info',
  muted: 'muted',
};

export function chartTheme() {
  return {
    ink: read('--ink'),
    inkSoft: read('--ink-soft'),
    muted: read('--muted'),
    line: read('--line'),
    lineFaint: read('--line-faint'),
    lineStrong: read('--line-strong'),
    surface: read('--surface'),
    surface2: read('--surface-2'),
    surface3: read('--surface-3'),
    accent: read('--accent'),
    accentSoft: read('--accent-soft'),
    danger: read('--danger'),
    sage: read('--sage'),
    ochre: read('--ochre'),
    rose: read('--rose'),
    info: read('--info'),
    font: read('--font-body') || 'sans-serif',
  };
}

export const toneColor = (tone, theme = chartTheme()) =>
  theme[TONE_VAR[tone]] || theme.accent;

export function budgetColor(percent, theme = chartTheme()) {
  if (percent >= 100) return theme.danger;
  if (percent >= 80) return theme.ochre;
  return theme.sage;
}

const moneyTick = (value) => {
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
};

const baseOptions = (theme) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? false
    : { duration: 520, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: theme.surface,
      titleColor: theme.ink,
      bodyColor: theme.inkSoft,
      borderColor: theme.line,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
      titleFont: { family: theme.font, size: 11, weight: '600' },
      bodyFont: { family: theme.font, size: 11 },
      displayColors: true,
      boxPadding: 4,
    },
  },
});

export function drawCategoryChart(canvas, rows = []) {
  const theme = chartTheme();
  const chart = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          data: rows.map((r) => r.value),
          backgroundColor: rows.map((r) => r.color),
          borderColor: theme.surface,
          borderWidth: 2,
          hoverOffset: 3,
          borderRadius: 3,
        },
      ],
    },
    options: {
      ...baseOptions(theme),
      cutout: '68%',
      layout: { padding: 4 },
      plugins: {
        ...baseOptions(theme).plugins,
        tooltip: {
          ...baseOptions(theme).plugins.tooltip,
          callbacks: {
            label: (c) => ` ${c.label}: $${Number(c.raw).toFixed(2)}`,
          },
        },
      },
    },
  });
  return chart;
}

export function drawTrendChart(canvas, { days = [], dates = [], values = [], todayIndex = -1 } = {}) {
  const theme = chartTheme();
  const labelDate = (index) => {
    const raw = dates[index];
    if (!raw) return '';
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };
  const chart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Spent',
          data: values,
          backgroundColor: values.map((_, i) =>
            i === todayIndex ? theme.accent : theme.lineStrong
          ),
          hoverBackgroundColor: theme.accent,
          borderRadius: 3,
          borderSkipped: false,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      ...baseOptions(theme),
      layout: { padding: { top: 4 } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: theme.muted,
            font: { family: theme.font, size: 9.5 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 11,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: theme.lineFaint, drawTicks: false },
          border: { display: false },
          ticks: {
            color: theme.muted,
            font: { family: theme.font, size: 9.5 },
            padding: 6,
            maxTicksLimit: 4,
            callback: moneyTick,
          },
        },
      },
      plugins: {
        ...baseOptions(theme).plugins,
        tooltip: {
          ...baseOptions(theme).plugins.tooltip,
          callbacks: {
            title: (items) => labelDate(items[0]?.dataIndex) || items[0]?.label || '',
            label: (c) => ` $${Number(c.raw).toFixed(2)} spent`,
          },
        },
      },
    },
  });
  return chart;
}

export function drawBudgetChart(canvas, rows = []) {
  const theme = chartTheme();
  const chart = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          label: 'Budget',
          data: rows.map((r) => r.limit),
          backgroundColor: theme.surface3,
          hoverBackgroundColor: theme.surface3,
          borderRadius: 4,
          maxBarThickness: 9,
        },
        {
          label: 'Spent',
          data: rows.map((r) => r.spent),
          backgroundColor: rows.map((r) => budgetColor(r.percent, theme)),
          hoverBackgroundColor: rows.map((r) => budgetColor(r.percent, theme)),
          borderRadius: 4,
          maxBarThickness: 9,
        },
      ],
    },
    options: {
      ...baseOptions(theme),
      indexAxis: 'y',
      layout: { padding: { right: 8 } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: theme.lineFaint, drawTicks: false },
          border: { display: false },
          ticks: {
            color: theme.muted,
            font: { family: theme.font, size: 9 },
            maxTicksLimit: 4,
            callback: moneyTick,
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: theme.inkSoft,
            font: { family: theme.font, size: 10.5, weight: '500' },
            padding: 6,
          },
        },
      },
      plugins: {
        ...baseOptions(theme).plugins,
        tooltip: {
          ...baseOptions(theme).plugins.tooltip,
          callbacks: {
            label: (c) => ` ${c.dataset.label}: $${Number(c.raw).toFixed(2)}`,
          },
        },
      },
    },
  });
  return chart;
}
